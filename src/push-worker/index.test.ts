import { describe, expect, it, vi } from "vitest";
import { installPushHandlers, readPayload, sameOriginLink, type PushWorkerScope } from "./index";

const ORIGIN = "https://app.example.test";

function worker(windows: { url: string }[] = []) {
  const handlers: Record<string, (event: never) => void> = {};
  const shown: { title: string; options: Record<string, unknown> }[] = [];
  const focused: string[] = [];
  const navigated: string[] = [];
  const opened: string[] = [];
  const badge = { set: vi.fn(async () => undefined), clear: vi.fn(async () => undefined) };
  const scope = {
    addEventListener: (type: string, listener: (event: never) => void) => void (handlers[type] = listener),
    location: { origin: ORIGIN },
    registration: { showNotification: async (title: string, options: Record<string, unknown>) => void shown.push({ title, options }) },
    clients: {
      matchAll: async () => windows.map((w) => ({ url: w.url, focus: async () => void focused.push(w.url), navigate: async (to: string) => void navigated.push(to) })),
      openWindow: async (url: string) => void opened.push(url),
    },
    navigator: { setAppBadge: badge.set, clearAppBadge: badge.clear },
  } as unknown as PushWorkerScope;
  return { scope, handlers, shown, focused, navigated, opened, badge };
}

const push = (body: unknown) => {
  const waits: Promise<unknown>[] = [];
  return { data: { json: () => body }, waitUntil: (work: Promise<unknown>) => void waits.push(work), done: () => Promise.all(waits) };
};
const click = (data: unknown) => {
  const waits: Promise<unknown>[] = [];
  const notification = { close: vi.fn(), data };
  return { notification, waitUntil: (work: Promise<unknown>) => void waits.push(work), done: () => Promise.all(waits) };
};

const payload = { notification_id: 7, category: "tickets.assigned", title: "Ticket assigned", body: "Ana gave you #12", link: "/tickets/12", tag: "tickets.assigned", unread_count: 3 };

describe("the push handler", () => {
  it("shows the notification the payload describes and sets the badge", async () => {
    const w = worker();
    installPushHandlers({ icon: "/icon.png" }, w.scope);
    const event = push(payload);
    w.handlers.push!(event as never);
    await event.done();
    expect(w.shown).toEqual([{ title: "Ticket assigned", options: { body: "Ana gave you #12", icon: "/icon.png", badge: "/icon.png", tag: "tickets.assigned", data: { notification_id: 7, link: "/tickets/12" } } }]);
    expect(w.badge.set).toHaveBeenCalledWith(3);
  });

  it("clears the badge at zero unread and leaves it alone when the payload has no count", async () => {
    const w = worker();
    installPushHandlers({}, w.scope);
    const zero = push({ ...payload, unread_count: 0 });
    w.handlers.push!(zero as never);
    await zero.done();
    expect(w.badge.clear).toHaveBeenCalledTimes(1);
    const { unread_count: _gone, ...without } = payload;
    const none = push(without);
    w.handlers.push!(none as never);
    await none.done();
    expect(w.badge.set).not.toHaveBeenCalled();
    expect(w.badge.clear).toHaveBeenCalledTimes(1);
  });

  it("still shows a notification for a push that is not JSON, and never opens a link to another site", async () => {
    const w = worker();
    installPushHandlers({ fallbackTitle: "News" }, w.scope);
    const broken = { data: { json: () => { throw new SyntaxError("x"); } }, waitUntil: (work: Promise<unknown>) => void work };
    w.handlers.push!(broken as never);
    const away = push({ ...payload, link: "https://evil.example.test/login" });
    w.handlers.push!(away as never);
    await away.done();
    expect(w.shown[0]).toMatchObject({ title: "News" });
    expect(w.shown[1]?.options.data).toEqual({ notification_id: 7, link: "/" });
  });
});

describe("the notification click", () => {
  it("focuses the open window of the application and navigates it to the link", async () => {
    const w = worker([{ url: "https://other.example.test/x" }, { url: `${ORIGIN}/dashboard` }]);
    installPushHandlers({}, w.scope);
    const event = click({ notification_id: 7, link: "/tickets/12?tab=notes#top" });
    w.handlers.notificationclick!(event as never);
    await event.done();
    expect(event.notification.close).toHaveBeenCalled();
    expect(w.focused).toEqual([`${ORIGIN}/dashboard`]);
    expect(w.navigated).toEqual(["/tickets/12?tab=notes#top"]);
    expect(w.opened).toEqual([]);
  });

  it("opens a window when the open one cannot be navigated", async () => {
    const w = worker([{ url: `${ORIGIN}/dashboard` }]);
    const matchAll = w.scope.clients.matchAll;
    w.scope.clients.matchAll = async (options) => (await matchAll(options)).map((client) => ({ ...client, navigate: async () => Promise.reject(new TypeError("uncontrolled")) }));
    installPushHandlers({}, w.scope);
    const event = click({ notification_id: 7, link: "/tickets/12" });
    w.handlers.notificationclick!(event as never);
    await event.done();
    expect(w.opened).toEqual(["/tickets/12"]);
  });

  it("opens a window when none is open, and only ever on this origin", async () => {
    const w = worker([{ url: "https://other.example.test/x" }]);
    installPushHandlers({}, w.scope);
    const own = click({ notification_id: 7, link: "/tickets/12" });
    w.handlers.notificationclick!(own as never);
    await own.done();
    const foreign = click({ notification_id: 8, link: "//evil.example.test/phish" });
    w.handlers.notificationclick!(foreign as never);
    await foreign.done();
    expect(w.opened).toEqual(["/tickets/12", "/"]);
  });
});

describe("the helpers", () => {
  it("reads a payload defensively", () => {
    expect(readPayload(null)).toEqual({ notification_id: 0, category: "", title: "", body: "", link: "", tag: "" });
    expect(readPayload({ title: 5, notification_id: "7", unread_count: 2 })).toEqual({ notification_id: 0, category: "", title: "", body: "", link: "", tag: "", unread_count: 2 });
  });

  it.each([
    ["/a/b?c=1#d", "/a/b?c=1#d"],
    [`${ORIGIN}/x`, "/x"],
    ["https://evil.example.test/", "/"],
    ["//evil.example.test/", "/"],
    ["javascript:alert(1)", "/"],
    ["", "/"],
    [undefined, "/"],
  ])("keeps %s on this origin as %s", (link, expected) => {
    expect(sameOriginLink(link, ORIGIN)).toBe(expected);
  });
});
