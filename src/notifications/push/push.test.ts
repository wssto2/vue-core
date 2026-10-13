import { fireEvent, screen, waitFor, within } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callsTo, dataOf, refusal, startScreen, stopApplications } from "../../identity/testing";
import { toast } from "../../overlay";
import { settle } from "../../testing";
import { notificationsFeature, type NotificationsFeatureOptions } from "../feature";
import { connection } from "../testing";
import { endpointHash } from "./browser";
import { fakePush, fakeSubscription, PUBLIC_KEY, type FakePush, type FakePushOptions } from "./testing";

vi.setConfig({ testTimeout: 30_000 });

let push: FakePush;
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => connection().response)); // the bell's stream
});
afterEach(() => {
  push?.restore();
  stopApplications();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const category = (name: string, email = "default", pushSource = "default") => ({ category: name, email: { enabled: true, source: email }, push: { enabled: true, source: pushSource } });
const preferences = (extra: object = {}) =>
  dataOf({
    email_available: true,
    push_available: true,
    categories: [category("tickets.assigned"), category("billing.overdue", "enforced", "enforced")],
    quiet_hours: { enabled: false, start: 1260, end: 420 },
    time_zone: "Europe/Zagreb",
    ...extra,
  });
const config = dataOf({ enabled: true, public_key: PUBLIC_KEY });
const device = (id: number, extra: object = {}) => ({ id, label: `Browser ${id}`, platform: "web", endpoint_hash: `hash-${id}`, active: true, created_at: "2026-10-01T09:00:00Z", last_seen_at: "2026-10-12T09:00:00Z", last_success_at: null, ...extra });
const devices = (...items: object[]) => dataOf({ items });

async function open(browser: FakePushOptions, answers: Record<string, Parameters<typeof startScreen>[0]["answers"][string]> = {}, feature?: NotificationsFeatureOptions, location = "/profile/notifications") {
  push = fakePush(browser);
  return startScreen({
    permissions: [],
    location,
    features: [notificationsFeature(feature)],
    answers: { "GET /v1/notifications/preferences": preferences(), "GET /v1/notifications/push": config, "GET /v1/notifications/devices": devices(), "POST /v1/notifications/devices": dataOf(device(1)), ...answers },
  });
}
const thisDevice = () => document.querySelector<HTMLElement>("[data-notification-this-device]")!;
const stateOf = () => thisDevice()?.getAttribute("data-state");

describe("push on this device", () => {
  it("is left out when the server has no push", async () => {
    const { calls } = await open({}, { "GET /v1/notifications/preferences": preferences({ push_available: false }) });
    expect(thisDevice()).toBeNull();
    expect(document.querySelector("[data-notification-devices]")).toBeNull();
    expect(callsTo(calls, "GET", "/v1/notifications/devices")).toHaveLength(0);
  });

  it.each([
    ["off where the permission was not asked yet", {}, "off"],
    ["blocked where the permission was denied", { permission: "denied" as const }, "denied"],
    ["unsupported in a browser without the Push API", { supported: false }, "unsupported"],
    ["the home-screen guidance in an iPhone Safari tab", { iphone: true }, "ios-browser"],
    ["off in the app installed to the iPhone home screen", { iphone: true, standalone: true }, "off"],
    ["on where the browser holds a subscription and the permission", { permission: "granted" as const, subscription: fakeSubscription() }, "on"],
  ])("shows %s", async (_name, browser: FakePushOptions, state) => {
    await open(browser);
    await waitFor(() => expect(stateOf()).toBe(state));
  });

  it("asks for the permission only from the button, then subscribes with the server's key and registers the device", async () => {
    const { calls } = await open({}, { "POST /v1/notifications/devices": dataOf(device(1)) });
    await waitFor(() => expect(stateOf()).toBe("off"));
    expect(push.prompts).toBe(0);
    await fireEvent.click(thisDevice().querySelector("[data-push-enable] button")!);
    await waitFor(() => expect(stateOf()).toBe("on"));
    expect(push.prompts).toBe(1);
    expect(push.subscribed).toBe(1);
    const [post] = callsTo(calls, "POST", "/v1/notifications/devices");
    expect(JSON.parse(String(post?.init.body))).toEqual({ endpoint: "https://push.example.test/send/new", p256dh: "p256dh-key", auth: "auth-secret" });
  });

  it("registers nothing when the permission is refused, and says it is blocked", async () => {
    const { calls } = await open({ answer: "denied" });
    await waitFor(() => expect(stateOf()).toBe("off"));
    await fireEvent.click(thisDevice().querySelector("[data-push-enable] button")!);
    await waitFor(() => expect(stateOf()).toBe("denied"));
    expect(callsTo(calls, "POST", "/v1/notifications/devices")).toHaveLength(0);
  });

  it("turns push off for this browser: the device leaves the account and the subscription is cancelled", async () => {
    const subscription = fakeSubscription();
    const { calls } = await open({ permission: "granted", subscription }, { "POST /v1/notifications/devices/unsubscribe": devices() });
    await waitFor(() => expect(stateOf()).toBe("on"));
    await fireEvent.click(thisDevice().querySelector("[data-push-disable] button")!);
    await waitFor(() => expect(stateOf()).toBe("off"));
    expect(JSON.parse(String(callsTo(calls, "POST", "/v1/notifications/devices/unsubscribe")[0]?.init.body))).toEqual({ endpoint: subscription.endpoint });
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("says push could not be turned on when registering fails", async () => {
    const error = vi.spyOn(toast, "error").mockImplementation(() => undefined as never);
    await open({}, { "POST /v1/notifications/devices": refusal(500, "internal") });
    await waitFor(() => expect(stateOf()).toBe("off"));
    await fireEvent.click(thisDevice().querySelector("[data-push-enable] button")!);
    await waitFor(() => expect(error).toHaveBeenCalledWith("Push could not be turned on."));
  });
});

describe("the subscription of the session", () => {
  it("registers the subscription the browser already holds, once, when the session starts", async () => {
    const { calls } = await open({ permission: "granted", subscription: fakeSubscription() }, { "POST /v1/notifications/devices": dataOf(device(1)) }, undefined, "/");
    await settle();
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/notifications/devices")).toHaveLength(1));
    expect(callsTo(calls, "GET", "/v1/notifications/push")).toHaveLength(1);
  });

  it("asks the server for nothing when the browser holds no subscription", async () => {
    const { calls } = await open({ permission: "granted" }, {}, undefined, "/");
    await settle();
    expect(callsTo(calls, "GET", "/v1/notifications/push")).toHaveLength(0);
    expect(callsTo(calls, "POST", "/v1/notifications/devices")).toHaveLength(0);
  });

  it("drops a subscription the permission no longer backs, without telling the server", async () => {
    const subscription = fakeSubscription();
    const { calls } = await open({ permission: "denied", subscription }, {}, undefined, "/");
    await waitFor(() => expect(subscription.unsubscribe).toHaveBeenCalledTimes(1));
    expect(callsTo(calls, "POST", "/v1/notifications/devices")).toHaveLength(0);
  });

  it("replaces a subscription made with another key", async () => {
    const stale = fakeSubscription("https://push.example.test/send/old", new Uint8Array([1, 2, 3]).buffer);
    const { calls } = await open({ permission: "granted", subscription: stale }, { "POST /v1/notifications/devices": dataOf(device(1)) }, undefined, "/");
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/notifications/devices")).toHaveLength(1));
    expect(stale.unsubscribe).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(callsTo(calls, "POST", "/v1/notifications/devices")[0]?.init.body)).endpoint).toBe("https://push.example.test/send/new");
  });

  it("does nothing with push: false", async () => {
    const { calls } = await open({ permission: "granted", subscription: fakeSubscription() }, {}, { push: false }, "/");
    await settle();
    expect(callsTo(calls, "GET", "/v1/notifications/push")).toHaveLength(0);
  });

  it("removes the subscription right before the person signs out", async () => {
    const subscription = fakeSubscription();
    const { calls, platform } = await open({ permission: "granted", subscription }, { "POST /v1/notifications/devices": dataOf(device(1)), "POST /v1/notifications/devices/unsubscribe": devices(), "POST /v1/auth/logout": dataOf({}) }, undefined, "/");
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/notifications/devices")).toHaveLength(1));
    await platform.session.signOut().catch(() => undefined);
    expect(JSON.parse(String(callsTo(calls, "POST", "/v1/notifications/devices/unsubscribe")[0]?.init.body))).toEqual({ endpoint: subscription.endpoint });
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe("the devices", () => {
  const row = (id: number) => document.querySelector<HTMLElement>(`[data-device="${id}"]`)!;
  /** Opens the row's "⋯" menu and returns its item of that name. */
  async function menuItem(id: number, name: string) {
    await fireEvent.click(row(id).querySelector("[data-device-menu]")!);
    await settle();
    return screen.getByRole("menuitem", { name });
  }

  it("lists each device with its name, this device, a disabled one and when it was last used", async () => {
    const subscription = fakeSubscription();
    const mine = await endpointHash(subscription.endpoint);
    await open({ permission: "granted", subscription }, { "GET /v1/notifications/devices": devices(device(1, { endpoint_hash: mine, last_success_at: "2026-10-12T10:00:00Z" }), device(2, { active: false })) });
    await waitFor(() => expect(row(1)).toBeTruthy());
    expect(row(1).textContent).toContain("Browser 1");
    expect(row(1).querySelector("[data-device-current]")).not.toBeNull();
    expect(row(1).textContent).toContain("Last used");
    expect(row(1).textContent).toContain("Last push");
    expect(row(2).querySelector("[data-device-current]")).toBeNull();
    expect(row(2).querySelector("[data-device-disabled]")).not.toBeNull();
    expect((await menuItem(2, "Send test")).hasAttribute("disabled")).toBe(true);
    await fireEvent.keyDown(document.body, { key: "Escape" });
    await settle();
    expect((await menuItem(1, "Send test")).hasAttribute("disabled")).toBe(false);
  });

  it("has its own sentence when no device has push on", async () => {
    await open({});
    await waitFor(() => expect(document.querySelector("[data-notification-devices]")?.textContent).toContain("No device has push turned on yet."));
  });

  it("renames a device in place", async () => {
    const { calls } = await open({}, { "GET /v1/notifications/devices": devices(device(1)), "PATCH /v1/notifications/devices/1": dataOf(device(1, { label: "Work laptop" })) });
    await waitFor(() => expect(row(1)).toBeTruthy());
    await fireEvent.click(await menuItem(1, "Rename"));
    await settle();
    await fireEvent.update(screen.getByLabelText("Name"), "Work laptop");
    await fireEvent.click(document.querySelector("[data-device-save]")!);
    await waitFor(() => expect(row(1).textContent).toContain("Work laptop"));
    expect(JSON.parse(String(callsTo(calls, "PATCH", "/v1/notifications/devices/1")[0]?.init.body))).toEqual({ label: "Work laptop" });
  });

  it("removes a device only after the confirmation", async () => {
    const { calls } = await open({}, { "GET /v1/notifications/devices": devices(device(1), device(2)), "DELETE /v1/notifications/devices/1": devices(device(2)) });
    await waitFor(() => expect(row(1)).toBeTruthy());
    await fireEvent.click(await menuItem(1, "Remove"));
    await settle();
    expect(callsTo(calls, "DELETE", "/v1/notifications/devices/1")).toHaveLength(0);
    expect(screen.getByText(/“Browser 1” stops getting push notifications/)).toBeTruthy();
    await fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(document.querySelector('[data-device="1"]')).toBeNull());
    expect(row(2)).toBeTruthy();
  });

  it("sends a test push to one device", async () => {
    const success = vi.spyOn(toast, "success").mockImplementation(() => undefined as never);
    const { calls } = await open({}, { "GET /v1/notifications/devices": devices(device(1)), "POST /v1/notifications/devices/1/test": devices(device(1)) });
    await waitFor(() => expect(row(1)).toBeTruthy());
    await fireEvent.click(await menuItem(1, "Send test"));
    await waitFor(() => expect(success).toHaveBeenCalledWith("Test sent."));
    expect(callsTo(calls, "POST", "/v1/notifications/devices/1/test")).toHaveLength(1);
  });
});

describe("push per category", () => {
  const switchOf = (code: string, channel: string) => within(document.querySelector<HTMLElement>(`[data-category="${code}"] [data-channel="${channel}"]`)!).getByRole("switch");

  it("puts a push switch next to e-mail, saved on the push route", async () => {
    const { calls } = await open({}, { "PUT /v1/notifications/preferences/tickets.assigned/push": dataOf({ ...category("tickets.assigned"), push: { enabled: false, source: "person" } }) });
    await waitFor(() => expect(switchOf("tickets.assigned", "push")).toBeTruthy());
    expect(switchOf("tickets.assigned", "email").getAttribute("aria-checked")).toBe("true");
    await fireEvent.click(switchOf("tickets.assigned", "push"));
    await settle();
    expect(JSON.parse(String(callsTo(calls, "PUT", "/v1/notifications/preferences/tickets.assigned/push")[0]?.init.body))).toEqual({ push: false });
    expect(switchOf("tickets.assigned", "push").getAttribute("aria-checked")).toBe("false");
    expect(switchOf("tickets.assigned", "email").getAttribute("aria-checked")).toBe("true");
  });

  it("locks an enforced push setting and takes a refused switch back", async () => {
    const error = vi.spyOn(toast, "error").mockImplementation(() => undefined as never);
    await open({}, { "PUT /v1/notifications/preferences/tickets.assigned/push": refusal(422, "notification.setting.enforced") });
    await waitFor(() => expect(document.querySelector('[data-category="billing.overdue"]')).toBeTruthy());
    expect(within(document.querySelector<HTMLElement>('[data-category="billing.overdue"]')!).queryByRole("switch")).toBeNull();
    await fireEvent.click(switchOf("tickets.assigned", "push"));
    await settle();
    expect(switchOf("tickets.assigned", "push").getAttribute("aria-checked")).toBe("true");
    expect(error).toHaveBeenCalledWith("Your organisation decides this setting, so you cannot change it.");
  });

  it("shows only the push switch where e-mail is not available", async () => {
    await open({}, { "GET /v1/notifications/preferences": preferences({ email_available: false }) });
    await waitFor(() => expect(switchOf("tickets.assigned", "push")).toBeTruthy());
    expect(document.querySelector('[data-category="tickets.assigned"] [data-channel="email"]')).toBeNull();
  });
});
