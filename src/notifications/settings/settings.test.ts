import { describe, expect, it } from "vitest";
import { isApiError } from "../../client";
import { createTestApp, createTestPlatform, deferred, jsonResponse, routedTransport, settle, withSetup } from "../../testing";
import type { Preferences } from "../../modules/notification/entities";
import { useSettings } from "./settings";

const preferences = (): Preferences => ({
  email_available: true,
  categories: [
    { category: "tickets.assigned", email: { enabled: true, source: "default" } },
    { category: "tickets.commented", email: { enabled: false, source: "enforced" } },
  ],
  quiet_hours: { enabled: true, start: 1260, end: 420 },
  time_zone: "Europe/Zagreb",
});
const ok = (data: unknown) => jsonResponse(200, { success: true, data });
const refused = jsonResponse(422, { success: false, error: "no", code: "notification.setting.enforced" });

async function start(answers: Parameters<typeof routedTransport>[0]) {
  const { transport, calls } = routedTransport({ "GET /v1/notifications/preferences": ok(preferences()), ...answers });
  const platform = createTestPlatform({ transport, config: { apiBase: "" } });
  const { result: settings } = withSetup(() => useSettings(), createTestApp({ platform }));
  await settle();
  return { settings, calls };
}

describe("useSettings", () => {
  it("loads the preferences", async () => {
    const { settings } = await start({});
    expect(settings.loaded.data.value?.categories).toHaveLength(2);
  });

  it("shows a switch at once, then what the server answered", async () => {
    const answer = deferred<Response>();
    const { settings, calls } = await start({ "PUT /v1/notifications/preferences/tickets.assigned": () => answer.promise });
    const saving = settings.setEmail("tickets.assigned", false);
    await settle();
    expect(settings.loaded.data.value?.categories[0]?.email).toEqual({ enabled: false, source: "person" });
    expect(settings.saving.value).toEqual(["tickets.assigned"]);
    expect(JSON.parse(String(calls.at(-1)?.init.body))).toEqual({ email: false });
    answer.resolve(ok({ category: "tickets.assigned", email: { enabled: false, source: "person" } }));
    await saving;
    expect(settings.saving.value).toEqual([]);
    expect(settings.loaded.data.value?.categories[0]?.email.source).toBe("person");
  });

  it("puts the switch back and rejects with the server's reason when it is refused", async () => {
    const { settings } = await start({ "PUT /v1/notifications/preferences/tickets.assigned": refused });
    const error = await settings.setEmail("tickets.assigned", false).catch((reason: unknown) => reason);
    expect(isApiError(error) && error.code).toBe("notification.setting.enforced");
    expect(settings.loaded.data.value?.categories[0]?.email).toEqual({ enabled: true, source: "default" });
    expect(settings.saving.value).toEqual([]);
  });

  it("does not send a second change of a category while one is on its way", async () => {
    const answer = deferred<Response>();
    const { settings, calls } = await start({ "PUT /v1/notifications/preferences/tickets.assigned": () => answer.promise });
    void settings.setEmail("tickets.assigned", false);
    await settings.setEmail("tickets.assigned", true);
    expect(calls.filter((call) => call.method === "PUT")).toHaveLength(1);
    answer.resolve(ok({ category: "tickets.assigned", email: { enabled: false, source: "person" } }));
  });

  it("shows the quiet hours the server saved", async () => {
    const { settings, calls } = await start({ "PUT /v1/notifications/quiet-hours": ok({ enabled: false, start: 1320, end: 360 }) });
    await settings.saveQuietHours({ enabled: false, start: 1320, end: 360 });
    expect(JSON.parse(String(calls.at(-1)?.init.body))).toEqual({ enabled: false, start: 1320, end: 360 });
    expect(settings.loaded.data.value?.quiet_hours).toEqual({ enabled: false, start: 1320, end: 360 });
  });
});
