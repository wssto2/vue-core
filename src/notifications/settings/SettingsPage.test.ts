import { fireEvent, screen, waitFor, within } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callsTo, dataOf, refusal, startScreen, stopApplications } from "../../identity/testing";
import { toast } from "../../overlay";
import { settle } from "../../testing";
import { notificationsFeature, type NotificationsFeatureOptions } from "../feature";
import { connection } from "../testing";

vi.setConfig({ testTimeout: 30_000 });

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => connection().response)); // the bell's stream
});
afterEach(() => {
  stopApplications();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const preferences = (extra: object = {}) =>
  dataOf({
    email_available: true,
    categories: [
      { category: "tickets.assigned", email: { enabled: true, source: "default" } },
      { category: "tickets.commented", email: { enabled: false, source: "person" } },
      { category: "billing.overdue", email: { enabled: true, source: "enforced" } },
    ],
    quiet_hours: { enabled: true, start: 1260, end: 420 },
    time_zone: "Europe/Zagreb",
    ...extra,
  });

const messages = { en: { notifications: { categories: { tickets: { assigned: { label: "Ticket assigned to me", description: "When someone gives you a ticket" } } } } } };

async function open(answers: Record<string, Parameters<typeof startScreen>[0]["answers"][string]> = {}, feature?: NotificationsFeatureOptions, location = "/profile/notifications") {
  return startScreen({ permissions: [], location, features: [notificationsFeature(feature)], messages, answers: { "GET /v1/notifications/preferences": preferences(), ...answers } });
}
const row = (code: string) => document.querySelector<HTMLElement>(`[data-category="${code}"]`)!;
const switchOf = (code: string) => within(row(code)).getByRole("switch");

describe("the notification settings page", () => {
  it("lists the categories by the application's texts, falling back to the code", async () => {
    await open();
    expect(row("tickets.assigned").textContent).toContain("Ticket assigned to me");
    expect(row("tickets.assigned").textContent).toContain("When someone gives you a ticket");
    expect(row("tickets.commented").textContent).toContain("tickets.commented");
    expect(switchOf("tickets.assigned").getAttribute("aria-checked")).toBe("true");
    expect(switchOf("tickets.commented").getAttribute("aria-checked")).toBe("false");
    expect(document.body.textContent).toContain("In the app: always on");
  });

  it("saves a switch as it is switched", async () => {
    const { calls } = await open({ "PUT /v1/notifications/preferences/tickets.commented": dataOf({ category: "tickets.commented", email: { enabled: true, source: "person" } }) });
    await fireEvent.click(switchOf("tickets.commented"));
    await settle();
    const [put] = callsTo(calls, "PUT", "/v1/notifications/preferences/tickets.commented");
    expect(JSON.parse(String(put?.init.body))).toEqual({ email: true });
    expect(switchOf("tickets.commented").getAttribute("aria-checked")).toBe("true");
  });

  it("shows an enforced setting locked, with who decides", async () => {
    await open();
    expect(within(row("billing.overdue")).queryByRole("switch")).toBeNull();
    expect(row("billing.overdue").textContent).toContain("billing.overdue");
    expect(row("billing.overdue").textContent).toContain("Set by your organisation");
    expect(row("billing.overdue").textContent).toContain("Yes");
  });

  it("takes a refused switch back and says why", async () => {
    const error = vi.spyOn(toast, "error").mockImplementation(() => undefined as never);
    await open({ "PUT /v1/notifications/preferences/tickets.assigned": refusal(422, "notification.setting.enforced") });
    await fireEvent.click(switchOf("tickets.assigned"));
    await settle();
    expect(switchOf("tickets.assigned").getAttribute("aria-checked")).toBe("true");
    expect(error).toHaveBeenCalledWith("Your organisation decides this setting, so you cannot change it.");
  });

  it("says e-mail is unavailable and shows no switches and no quiet hours", async () => {
    await open({ "GET /v1/notifications/preferences": preferences({ email_available: false }) });
    expect(document.querySelector("[data-email-unavailable]")?.textContent).toContain("E-mail is not available here");
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    expect(document.querySelector("[data-notification-quiet-hours]")).toBeNull();
    expect(document.body.textContent).toContain("In the app: always on");
  });

  it("states the quiet hours in words, over midnight and with the zone", async () => {
    await open();
    const summary = document.querySelector("[data-quiet-summary]")?.textContent ?? "";
    expect(summary).toContain("Europe/Zagreb");
    expect(summary).toContain("Between 21:00 and 07:00 (Europe/Zagreb)");
    expect(summary).toContain("e-mail waits until the quiet hours end");
  });

  it("saves quiet hours in minutes after midnight", async () => {
    const { calls } = await open({ "PUT /v1/notifications/quiet-hours": dataOf({ enabled: true, start: 1320, end: 360 }) });
    const panel = within(document.querySelector<HTMLElement>("[data-notification-quiet-hours]")!);
    const from = panel.getByLabelText("From");
    await fireEvent.update(from, "22:00");
    await fireEvent.blur(from);
    const to = panel.getByLabelText("To");
    await fireEvent.update(to, "06:00");
    await fireEvent.blur(to);
    await fireEvent.click(panel.getByRole("button", { name: "Save quiet hours" }));
    await waitFor(() => expect(callsTo(calls, "PUT", "/v1/notifications/quiet-hours")).toHaveLength(1));
    expect(JSON.parse(String(callsTo(calls, "PUT", "/v1/notifications/quiet-hours")[0]?.init.body))).toEqual({ enabled: true, start: 1320, end: 360 });
  });

  it("refuses the same time twice on the field, without asking the server", async () => {
    const { calls } = await open();
    const panel = within(document.querySelector<HTMLElement>("[data-notification-quiet-hours]")!);
    const to = panel.getByLabelText("To");
    await fireEvent.update(to, "21:00");
    await fireEvent.blur(to);
    await fireEvent.click(panel.getByRole("button", { name: "Save quiet hours" }));
    await settle();
    expect(panel.getByText("From and to must be different times.")).toBeTruthy();
    expect(callsTo(calls, "PUT", "/v1/notifications/quiet-hours")).toHaveLength(0);
  });

  it("has an entry in the account menu that opens it", async () => {
    await open({}, undefined, "/");
    await fireEvent.click(screen.getByRole("button", { name: /Ana/ }));
    await settle();
    expect(screen.getByRole("link", { name: "Notification settings" }).getAttribute("href")).toBe("/profile/notifications");
  });

  it("is left out with settings: false", async () => {
    const { application } = await open({}, { settings: false }, "/");
    expect(application.router.hasRoute("notifications.settings")).toBe(false);
  });
});
