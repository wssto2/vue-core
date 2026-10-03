import { fireEvent, screen, waitFor, within } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApplication, type Application } from "../app";
import { options } from "../app/testing";
import { baseFeature } from "../shell/testing";
import { backofficeShell } from "../shell";
import { createTestPlatform, jsonResponse, mockMedia, routedTransport, settle } from "../testing";
import { notificationsFeature, type NotificationsFeatureOptions } from "./feature";
import { connection, count, item, page, type Connection } from "./testing";

const running: { application: Application; target: HTMLElement }[] = [];
let connections: Connection[] = [];
let media: ReturnType<typeof mockMedia>;

beforeEach(() => {
  connections = [];
  answers = baseAnswers();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const next = connection();
      connections.push(next);
      return next.response;
    }),
  );
});
afterEach(() => {
  for (const { application, target } of running.splice(0)) {
    application.dispose();
    target.remove();
  }
  media?.restore();
  vi.unstubAllGlobals();
});

const baseAnswers = () => ({
  "GET /api/v1/notifications/unread": count(0),
  "GET /api/v1/notifications": page([item(2, false, { title: "Ticket 7 was assigned to you", body: "From Ana", link: "/other" }), item(1, true, { title: "Welcome" })]),
  "POST /api/v1/notifications/2/read": count(0),
  "POST /api/v1/notifications/read": count(0),
});
let answers: Record<string, Response> = baseAnswers();

async function start(settings: { compact?: boolean; feature?: NotificationsFeatureOptions } = {}) {
  media = mockMedia({ compact: settings.compact ?? false });
  const { transport, calls } = routedTransport(answers);
  const platform = createTestPlatform({ user: { id: 1 }, config: { apiBase: "/api" }, transport });
  const application = createApplication(options(platform, [baseFeature, notificationsFeature(settings.feature)], "/", { shell: backofficeShell() }));
  const target = document.createElement("div");
  document.body.append(target);
  running.push({ application, target });
  await application.mount(target);
  await settle();
  return { application, platform, calls, target };
}

const bell = () => screen.getByRole("button", { name: /^Notifications/ });

describe("notificationsFeature", () => {
  it("opens the stream with the session and shows the unread count on the bell", async () => {
    await start();
    expect(connections).toHaveLength(1);
    expect(screen.queryByText("3")).toBeNull();

    connections[0]?.send({ type: "unread", unread_count: 3 });
    await settle();
    expect(bell().getAttribute("aria-label")).toBe("Notifications, 3 unread");
    expect(bell().querySelector("[data-header-action-badge]")?.textContent).toBe("3");

    connections[0]?.send({ type: "unread", unread_count: 250 });
    await settle();
    expect(bell().querySelector("[data-header-action-badge]")?.textContent).toBe("99+");
  });

  it("opens the inbox as a popover on wide screens: newest first, unread marked", async () => {
    await start();
    connections[0]?.send({ type: "unread", unread_count: 1 });
    await fireEvent.click(bell());
    await waitFor(() => expect(screen.getAllByRole("button").filter((b) => b.hasAttribute("data-notification-item"))).toHaveLength(2));

    const rows = document.querySelectorAll("[data-notification-item]");
    expect(rows[0]?.textContent).toContain("Ticket 7 was assigned to you");
    expect(rows[0]?.getAttribute("data-unread")).toBe("true");
    expect(rows[1]?.getAttribute("data-unread")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Notifications" })).toBeTruthy();
  });

  it("opens the inbox as a bottom sheet on phones", async () => {
    await start({ compact: true });
    connections[0]?.send({ type: "unread", unread_count: 1 });
    await fireEvent.click(bell());
    await waitFor(() => expect(document.querySelectorAll("[data-notification-item]")).toHaveLength(2));
    expect(document.querySelector('[data-part="panel"]')).not.toBeNull();
  });

  it("marks a notification read and opens its link through the router", async () => {
    const { application, calls } = await start();
    connections[0]?.send({ type: "unread", unread_count: 1 });
    await fireEvent.click(bell());
    await waitFor(() => expect(document.querySelectorAll("[data-notification-item]")).toHaveLength(2));
    await fireEvent.click(document.querySelectorAll("[data-notification-item]")[0]!);
    await waitFor(() => expect(application.router.currentRoute.value.path).toBe("/other"));
    expect(calls.some((call) => call.method === "POST" && call.url === "/api/v1/notifications/2/read")).toBe(true);
    expect(bell().querySelector("[data-header-action-badge]")).toBeNull();
  });

  it("marks all as read up to the newest id shown", async () => {
    const { calls } = await start();
    connections[0]?.send({ type: "unread", unread_count: 1 });
    await fireEvent.click(bell());
    await waitFor(() => expect(document.querySelectorAll("[data-notification-item]")).toHaveLength(2));
    await fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    await settle();
    const call = calls.find((c) => c.url === "/api/v1/notifications/read");
    expect(JSON.parse(String(call?.init.body))).toEqual({ up_to_id: 2 });
  });

  it("draws a category with its icon and hue", async () => {
    await start({ feature: { categories: { "tickets.assigned": { icon: "user3Line", hue: "blue" } } } });
    await fireEvent.click(bell());
    await waitFor(() => expect(document.querySelectorAll("[data-notification-item]")).toHaveLength(2));
    expect(document.querySelector("[data-notification-item] span[aria-hidden]")?.className).toContain("bg-category-blue-surface");
  });

  it("shows the empty state", async () => {
    answersFor({ "GET /api/v1/notifications": page([]) });
    await start();
    await fireEvent.click(bell());
    await waitFor(() => expect(screen.getByText("No notifications")).toBeTruthy());
  });

  it("shows a failed load with a retry", async () => {
    answersFor({ "GET /api/v1/notifications": jsonResponse(500, { success: false }) });
    await start();
    await fireEvent.click(bell());
    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(within(document.body).getByText("Notifications could not be loaded.")).toBeTruthy();
    answersFor({ "GET /api/v1/notifications": page([item(5)]) });
    await fireEvent.click(retry);
    await waitFor(() => expect(document.querySelectorAll("[data-notification-item]")).toHaveLength(1));
  });

  it("ends the stream and clears the bell when the person signs out", async () => {
    const { platform } = await start();
    connections[0]?.send({ type: "unread", unread_count: 4 });
    await settle();
    expect(bell()).toBeTruthy();
    await platform.session.signOut();
    await settle();
    expect(connections[0]?.state.cancelled).toBe(true);
    expect(screen.queryByRole("button", { name: /^Notifications/ })).toBeNull();
  });

  it("starts a new inbox when somebody else's session begins (sign in as), and shows nothing of the old one", async () => {
    const { platform } = await start();
    connections[0]?.send({ type: "unread", unread_count: 4 });
    await settle();
    expect(bell().getAttribute("aria-label")).toBe("Notifications, 4 unread");

    platform.session.establish({ ...platform.session.state.value, user: { id: 2 } } as never);
    await settle();
    expect(connections[0]?.state.cancelled).toBe(true);
    expect(connections).toHaveLength(2);
    expect(bell().getAttribute("aria-label")).toBe("Notifications");
  });
});

function answersFor(next: Record<string, Response>) {
  Object.assign(answers, next);
}
