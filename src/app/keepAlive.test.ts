import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { keepSessionAlive } from "./keepAlive";
import { deferred } from "../platform/testing";
import { fakeBackend, signedIn } from "./testing";

const NOW = new Date("2026-09-30T12:00:00Z").getTime();
const minutes = (count: number) => count * 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

type Renewal = (backend: ReturnType<typeof fakeBackend>["backend"]) => Promise<void>;

async function setup(expiresInMinutes: number | null, options: Parameters<typeof keepSessionAlive>[0] = {}, renewal?: Renewal) {
  const { platform, backend } = fakeBackend(signedIn(1, [], { expiresAt: expiresInMinutes === null ? null : new Date(NOW + minutes(expiresInMinutes)) }));
  await platform.session.restore();
  const controller = new AbortController();
  const report = vi.fn();
  const renew = vi.fn(
    renewal
      ? () => renewal(backend)
      : async () => {
          backend.snapshot = signedIn(1, [], { expiresAt: new Date(Date.now() + minutes(5)) }); // what a real renewal does: a later expiry
        },
  );
  const stop = keepSessionAlive({ renew, ...options }).start({ signal: controller.signal, platform, report, user: { id: 1 } }) as () => void;
  return { platform, backend, controller, report, renew, stop };
}

describe("keepSessionAlive", () => {
  it("renews shortly before the session expires, then again before the next expiry", async () => {
    const { renew, stop } = await setup(5);

    await vi.advanceTimersByTimeAsync(minutes(3.9));
    expect(renew).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(minutes(0.2)); // 4 min = expiry minus the 60 s margin
    expect(renew).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(minutes(4.1)); // the new expiry is 5 min after the renewal
    expect(renew).toHaveBeenCalledTimes(2);
    stop();
  });

  it("has nothing to renew for a session with no expiry", async () => {
    const { renew, stop } = await setup(null);
    await vi.advanceTimersByTimeAsync(minutes(60 * 24));
    expect(renew).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    stop();
  });

  it("catches up when the app returns to the foreground after a sleep, since timers do not run then", async () => {
    const { renew, stop } = await setup(5);

    vi.setSystemTime(NOW + minutes(10)); // the phone slept: the clock moved, no timer fired
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);

    expect(renew).toHaveBeenCalledTimes(1);
    stop();
  });

  it("catches up when the network comes back, and does nothing while offline", async () => {
    const { renew, stop } = await setup(5);
    const online = vi.spyOn(navigator, "onLine", "get");

    online.mockReturnValue(false);
    vi.setSystemTime(NOW + minutes(10));
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(renew).not.toHaveBeenCalled();

    online.mockReturnValue(true);
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(renew).toHaveBeenCalledTimes(1);
    stop();
  });

  it("shares one renewal between triggers that fire together", async () => {
    const gate = deferred<void>();
    const { renew, stop } = await setup(5, {}, () => gate.promise);

    vi.setSystemTime(NOW + minutes(10));
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);

    expect(renew).toHaveBeenCalledTimes(1);
    gate.resolve();
    stop();
  });

  it("does not spin when a renewal leaves the expiry where it was: it waits `retryAfter`", async () => {
    const { renew, stop } = await setup(0.5, { retryAfter: 30_000 }, async (backend) => {
      backend.snapshot = signedIn(1, [], { expiresAt: new Date(NOW + minutes(0.5)) }); // the server did not move the expiry
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(renew).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(29_000);
    expect(renew).toHaveBeenCalledTimes(1); // ARV's timer re-fired at once here
    await vi.advanceTimersByTimeAsync(2_000);
    expect(renew).toHaveBeenCalledTimes(2);
    stop();
  });

  it("a renewal that answers after the session ended schedules nothing (ARV started a timer after unmount)", async () => {
    const gate = deferred<void>();
    const { controller, stop } = await setup(0.5, {}, () => gate.promise); // due at once: the renewal is in flight
    await vi.advanceTimersByTimeAsync(0);

    controller.abort(); // sign-out
    stop();
    gate.resolve();
    await vi.advanceTimersByTimeAsync(0);

    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports a failed renewal and keeps going", async () => {
    const { report, stop } = await setup(0.5, {}, async () => {
      throw new Error("refresh refused");
    });

    await vi.advanceTimersByTimeAsync(0);

    expect(report).toHaveBeenCalledWith(expect.objectContaining({ message: "refresh refused" }));
    stop();
  });

  it("does not read the session back after a renew that ended it (ARV signed straight back in, in a loop)", async () => {
    const { platform, backend } = fakeBackend(signedIn(1, [], { expiresAt: new Date(NOW + minutes(0.5)) }));
    await platform.session.restore();
    const loads = backend.loads;
    const renew = async () => platform.session.expire(); // the refresh was refused; the access token still reads /me fine
    const stop = keepSessionAlive({ renew }).start({ signal: new AbortController().signal, platform, report: vi.fn(), user: { id: 1 } }) as () => void;

    await vi.advanceTimersByTimeAsync(0);

    expect(backend.loads).toBe(loads);
    expect(platform.session.state.value).toMatchObject({ status: "anonymous", reason: "expired" });
    stop();
  });

  it("without a renew call it reads the session again", async () => {
    const { platform, backend } = fakeBackend(signedIn(1, [], { expiresAt: new Date(NOW + minutes(2)) }));
    await platform.session.restore();
    const stop = keepSessionAlive().start({ signal: new AbortController().signal, platform, report: vi.fn(), user: { id: 1 } }) as () => void;
    const loads = backend.loads;

    await vi.advanceTimersByTimeAsync(minutes(1.1));

    expect(backend.loads).toBe(loads + 1);
    stop();
  });

  it("stopping removes the timer and the listeners", async () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const { stop } = await setup(5);
    expect(vi.getTimerCount()).toBe(1);

    stop();

    expect(vi.getTimerCount()).toBe(0);
    expect(remove.mock.calls.filter(([type]) => type === "visibilitychange")).toHaveLength(add.mock.calls.filter(([type]) => type === "visibilitychange").length);
  });
});
