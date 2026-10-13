import { afterEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/vue";
import { createHttpClient } from "../../client";
import { jsonResponse, routedTransport, type Answer } from "../../testing";
import { browserPush } from "./browser";
import { usePushState } from "./pushState";
import { fakePush, fakeSubscription, PUBLIC_KEY, type FakePush, type FakePushOptions } from "./testing";

let push: FakePush;
afterEach(() => {
  push?.restore();
  vi.unstubAllGlobals();
});

const ok = (data: unknown) => jsonResponse(200, { success: true, data });
function start(browser: FakePushOptions, answers: Record<string, Answer> = {}) {
  push = fakePush(browser);
  const { transport, calls } = routedTransport({ "GET /v1/notifications/push": ok({ enabled: true, public_key: PUBLIC_KEY }), "POST /v1/notifications/devices": ok({ id: 1 }), "POST /v1/notifications/devices/unsubscribe": ok({ items: [] }), ...answers });
  return { state: usePushState(createHttpClient({ transport }), browserPush()), calls };
}

describe("usePushState", () => {
  it("is subscribed as soon as it is ready for a browser that already has push on, so nothing is offered again", async () => {
    const { state } = start({ permission: "granted", subscription: fakeSubscription() });
    await waitFor(() => expect(state.ready.value).toBe(true));
    expect(state.available.value).toBe(true);
    expect(state.permission.value).toBe("granted");
    expect(state.subscribed.value).toBe(true);
  });

  it("offers push to a browser without it: available, not subscribed, and enable() prompts, subscribes and registers", async () => {
    const { state, calls } = start({});
    await waitFor(() => expect(state.ready.value).toBe(true));
    expect([state.available.value, state.subscribed.value, state.permission.value]).toEqual([true, false, "default"]);
    expect(push.prompts).toBe(0);
    expect(await state.enable()).toBe(true);
    expect([state.subscribed.value, state.permission.value, push.prompts]).toEqual([true, "granted", 1]);
    expect(calls.some((call) => call.method === "POST" && call.url === "/v1/notifications/devices")).toBe(true);
  });

  it("stays unsubscribed when the permission is refused, and says it is blocked", async () => {
    const { state } = start({ answer: "denied" });
    await waitFor(() => expect(state.ready.value).toBe(true));
    expect(await state.enable()).toBe(false);
    expect([state.subscribed.value, state.permission.value]).toEqual([false, "denied"]);
  });

  it("disable() cancels the subscription of this browser", async () => {
    const subscription = fakeSubscription();
    const { state } = start({ permission: "granted", subscription });
    await waitFor(() => expect(state.subscribed.value).toBe(true));
    await state.disable();
    expect(state.subscribed.value).toBe(false);
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("is not available where the server has no push, or the browser cannot", async () => {
    const noServer = start({}, { "GET /v1/notifications/push": ok({ enabled: false, public_key: "" }) });
    await waitFor(() => expect(noServer.state.ready.value).toBe(true));
    expect(noServer.state.available.value).toBe(false);
    push.restore();
    const old = start({ supported: false });
    await waitFor(() => expect(old.state.ready.value).toBe(true));
    expect(old.state.available.value).toBe(false);
  });
});
