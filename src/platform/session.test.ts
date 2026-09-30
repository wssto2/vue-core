import { describe, expect, it, vi } from "vitest";
import { createSession, type SessionAdapter, type SessionSnapshot } from "./session";
import { deferred, snapshotOf } from "./testing";

function adapterOf(load: SessionAdapter["load"], signOut: SessionAdapter["signOut"] = async () => {}): SessionAdapter {
  return { load, signOut };
}

describe("restore", () => {
  it("starts unknown, asks once, and shows loading while it waits", async () => {
    const answer = deferred<SessionSnapshot | null>();
    const load = vi.fn(() => answer.promise);
    const session = createSession(adapterOf(load));
    expect(session.state.value.status).toBe("unknown");
    expect(load).not.toHaveBeenCalled();

    const restoring = session.restore();
    expect(session.state.value.status).toBe("loading");
    answer.resolve(snapshotOf(7));
    const state = await restoring;
    expect(state).toMatchObject({ status: "authenticated", user: { id: 7 } });
    expect(session.state.value).toBe(state);
    await session.restore();
    expect(load).toHaveBeenCalledOnce(); // a known state is not asked again
  });

  it("is anonymous with reason none when the server has no session", async () => {
    const session = createSession(adapterOf(async () => null));
    expect(await session.restore()).toEqual({ status: "anonymous", reason: "none" });
  });

  it("is failed (not signed out) when the server could not say, and asking again recovers", async () => {
    const error = new Error("offline");
    const onError = vi.fn();
    const load = vi.fn<SessionAdapter["load"]>().mockRejectedValueOnce(error).mockResolvedValue(snapshotOf(1));
    const session = createSession(adapterOf(load), { onError });
    expect(await session.restore()).toEqual({ status: "failed", error });
    expect(onError).toHaveBeenCalledWith(error);
    expect((await session.restore()).status).toBe("authenticated");
  });

  it("shares one request between concurrent callers", async () => {
    const answer = deferred<SessionSnapshot | null>();
    const load = vi.fn(() => answer.promise);
    const session = createSession(adapterOf(load));
    const both = Promise.all([session.restore(), session.restore(), session.refresh()]);
    answer.resolve(snapshotOf(1));
    await both;
    expect(load).toHaveBeenCalledOnce();
  });

  it("survives an adapter that throws synchronously", async () => {
    const load = vi.fn<SessionAdapter["load"]>(() => {
      throw new Error("sync");
    });
    const session = createSession(adapterOf(load));
    expect((await session.restore()).status).toBe("failed");
    load.mockResolvedValue(snapshotOf(1));
    expect((await session.restore()).status).toBe("authenticated"); // nothing stuck in flight
  });
});

describe("refresh", () => {
  it("keeps the session visible while asking, and replaces it with the new answer", async () => {
    const answers = [deferred<SessionSnapshot | null>()];
    const session = createSession(adapterOf(() => answers[0]!.promise));
    session.establish(snapshotOf(1, {}));
    const refreshing = session.refresh();
    expect(session.state.value.status).toBe("authenticated"); // no flicker to loading
    answers[0]!.resolve(snapshotOf(1, { "a:b": { scope: { level: "x" }, qualifier: "all", clauses: [] } }));
    const state = await refreshing;
    expect(state.status === "authenticated" && Object.keys(state.access.permissions)).toEqual(["a:b"]);
  });

  it("keeps the session when a refresh fails (a dropped connection must not sign anyone out)", async () => {
    const onError = vi.fn();
    const session = createSession(adapterOf(async () => Promise.reject(new Error("offline"))), { onError });
    session.establish(snapshotOf(1));
    const state = await session.refresh();
    expect(state).toMatchObject({ status: "authenticated", user: { id: 1 } });
    expect(onError).toHaveBeenCalledOnce();
  });

  it("signs out when the server now says there is no session", async () => {
    const session = createSession(adapterOf(async () => null));
    session.establish(snapshotOf(1));
    expect(await session.refresh()).toEqual({ status: "anonymous", reason: "none" });
  });
});

describe("establish / expire / signOut", () => {
  it("establish makes the session authenticated", () => {
    const session = createSession(adapterOf(async () => null));
    session.establish(snapshotOf(3));
    expect(session.state.value).toMatchObject({ status: "authenticated", user: { id: 3 } });
  });

  it("expire moves a signed-in session to anonymous/expired and calls the hook once; otherwise does nothing", () => {
    const onExpired = vi.fn();
    const session = createSession(adapterOf(async () => null), { onExpired });
    session.expire();
    expect(session.state.value.status).toBe("unknown");
    expect(onExpired).not.toHaveBeenCalled();
    session.establish(snapshotOf(1));
    session.expire();
    session.expire();
    expect(session.state.value).toEqual({ status: "anonymous", reason: "expired" });
    expect(onExpired).toHaveBeenCalledOnce();
  });

  it("signOut clears the state first, then ends the session on the server", async () => {
    const signOut = deferred<void>();
    const session = createSession(adapterOf(async () => null, () => signOut.promise));
    session.establish(snapshotOf(1));
    const ending = session.signOut();
    expect(session.state.value).toEqual({ status: "anonymous", reason: "signedOut" }); // before the server answered
    signOut.resolve();
    await ending;
  });

  it("signOut still clears locally and reports it when the server call fails", async () => {
    const session = createSession(adapterOf(async () => null, async () => Promise.reject(new Error("offline"))));
    session.establish(snapshotOf(1));
    await expect(session.signOut()).rejects.toThrow("offline");
    expect(session.state.value.status).toBe("anonymous");
  });
});

describe("late answers of a previous session are dropped", () => {
  it("a restore answered after sign-out does not resurrect the session, and its request is aborted", async () => {
    const answer = deferred<SessionSnapshot | null>();
    let signal: AbortSignal | undefined;
    const session = createSession(
      adapterOf((given) => {
        signal = given;
        return answer.promise;
      }),
    );
    const restoring = session.restore();
    await session.signOut();
    expect(signal?.aborted).toBe(true);
    answer.resolve(snapshotOf(99));
    expect(await restoring).toEqual({ status: "anonymous", reason: "signedOut" });
    expect(session.state.value.status).toBe("anonymous");
  });

  it("a refresh answered after a different user signed in does not overwrite them", async () => {
    const answer = deferred<SessionSnapshot | null>();
    const session = createSession(adapterOf(() => answer.promise));
    session.establish(snapshotOf(1));
    const refreshing = session.refresh();
    session.establish(snapshotOf(2));
    answer.resolve(snapshotOf(1));
    await refreshing;
    expect(session.state.value).toMatchObject({ status: "authenticated", user: { id: 2 } });
  });

  it("a failure of the old request after a change is ignored", async () => {
    const answer = deferred<SessionSnapshot | null>();
    const onError = vi.fn();
    const session = createSession(adapterOf(() => answer.promise), { onError });
    const restoring = session.restore();
    session.establish(snapshotOf(5));
    answer.reject(new Error("late"));
    await restoring;
    expect(session.state.value.status).toBe("authenticated");
    expect(onError).not.toHaveBeenCalled();
  });

  it("a new request can start right after the old one was superseded", async () => {
    const first = deferred<SessionSnapshot | null>();
    const loads = [first.promise, Promise.resolve(snapshotOf(2))];
    const session = createSession(adapterOf(() => loads.shift() ?? Promise.resolve(null)));
    const old = session.restore();
    await session.signOut();
    const next = await session.refresh();
    expect(next).toMatchObject({ status: "authenticated", user: { id: 2 } });
    first.resolve(snapshotOf(1));
    await old;
    expect(session.state.value).toMatchObject({ user: { id: 2 } });
  });
});
