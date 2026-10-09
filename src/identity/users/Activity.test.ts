import { fireEvent, screen, waitFor, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../i18n/en.json";
import { settle } from "../../testing";
import { callsTo, dataOf, listOf, refusal, startScreen, stopApplications } from "../testing";

vi.setConfig({ testTimeout: 30_000 });
afterEach(stopApplications);

const person = { id: 2, login: "ivan", name: "Ivan Horvat", email: "ivan@example.test", phone: "", locale: "en", active: true, status: "active", last_sign_in: null, locked_until: null, created_at: "2026-09-01T08:00:00Z" };
const rows = [
  { id: 3, area: "crm", record_type: "customers", record_id: 7, action: "changed", signed_in_as: { id: 1, name: "Ana Anić" }, created_at: "2026-10-02T09:15:00Z" },
  { id: 2, area: "crm", record_type: "customers", record_id: 6, action: "created", signed_in_as: null, created_at: "2026-10-02T08:00:00Z" },
  { id: 1, area: "identity", record_type: "users", record_id: 2, action: "deleted", signed_in_as: null, created_at: "2026-10-01T08:00:00Z" },
];
const views = [{ key: "all", count: 3 }, { key: "crm", count: 2 }, { key: "billing", count: 0 }, { key: "identity", count: 1 }];

async function open(permissions: string[], answers: Parameters<typeof startScreen>[0]["answers"] = {}) {
  return startScreen({
    permissions,
    location: "/users/2/activity",
    users: { activityAreas: { crm: "areas.crm" } },
    messages: { en: { areas: { crm: "Customers" } } },
    answers: {
      "GET /v1/iam/users/2": dataOf(person),
      "GET /v1/iam/users/1": dataOf({ ...person, id: 1, name: "Ana Anić" }),
      "GET /v1/iam/users/2/sessions": dataOf({ sessions: [] }),
      "GET /v1/iam/users/2/activity": listOf(rows, { meta: { views } }),
      ...answers,
    },
  });
}

const FULL = ["iam.user:view", "iam.user.activity:view"];

describe("a person's activity", () => {
  it("is a section only for whoever holds iam.user.activity:view", async () => {
    const without = await open(["iam.user:view"]);
    // A denied section moves to the first one the person may open, once the record page has loaded.
    await waitFor(() => expect(without.application.router.currentRoute.value.name).toBe("users.record.general"), { timeout: 10_000 });
    await screen.findByText(en.core.users.intro.general);
    expect(without.target.querySelector('a[href="/users/2/activity"]')).toBeNull();
    expect(without.target.querySelector("[data-person-activity]")).toBeNull();
  });

  it("lists what the person did by day, with the area and the record, newest first", async () => {
    const { target } = await open(FULL);
    const feed = target.querySelector("[data-activity-feed]")!;
    const text = [...feed.querySelectorAll("[data-activity-row]")].map((row) => row.textContent);
    expect(text[0]).toContain("Changed a record");
    expect(text[0]).toContain("Customers");
    expect(text[0]).toContain("customers #7");
    expect(text[2]).toContain("Deleted a record");
    expect(text[2]).toContain("Accounts");
  });

  it("marks what was done while somebody was signed in as the person, with their name", async () => {
    const { target } = await open(FULL);
    await waitFor(() => expect(target.querySelector("[data-activity-signed-in-as]")?.textContent).toContain("Signed in as · Ana Anić"));
    expect(target.querySelectorAll("[data-activity-signed-in-as]")).toHaveLength(1);
  });

  it("offers the areas the server counted, named by the application, leaving out the empty ones", async () => {
    await open(FULL);
    const bar = within(screen.getByRole("tablist", { name: "Areas" }));
    expect(bar.getByRole("tab", { name: /All/ })).toBeTruthy();
    expect(bar.getByRole("tab", { name: /Customers/ })).toBeTruthy();
    expect(bar.getByRole("tab", { name: /Accounts/ })).toBeTruthy();
    expect(bar.queryByRole("tab", { name: /Other|billing/i })).toBeNull();
  });

  it("asks again for the area that was chosen, from the first page", async () => {
    const { calls } = await open(FULL);
    await fireEvent.click(screen.getByRole("tab", { name: /Customers/ }));
    await waitFor(() => expect(callsTo(calls, "GET", "/v1/iam/users/2/activity").at(-1)!.url).toContain("area=crm"));
    expect(callsTo(calls, "GET", "/v1/iam/users/2/activity").at(-1)!.url).toContain("page=1");
  });

  it("narrows by a date range, as days", async () => {
    const { calls } = await open(FULL);
    const from = screen.getByLabelText(/^From/);
    from.focus();
    await fireEvent.update(from, "10/1/2026");
    await fireEvent.keyDown(from, { key: "Enter" });
    await settle();
    await waitFor(() => expect(callsTo(calls, "GET", "/v1/iam/users/2/activity").at(-1)!.url).toContain("from=2026-10-01"));
  });

  it("says so when there is nothing in the range", async () => {
    const { target } = await open(FULL, { "GET /v1/iam/users/2/activity": listOf([], { meta: { views: [{ key: "all", count: 0 }] } }) });
    expect(target.querySelector("[data-activity-empty]")).not.toBeNull();
  });

  it("says why when the server refuses the range", async () => {
    const { target } = await open(FULL, { "GET /v1/iam/users/2/activity": refusal(422, "identity.activity.range_invalid", { fields: { to: "identity.activity.range_invalid" } }) });
    await settle();
    expect(target.textContent).toContain("The end of the range is before its start.");
  });
});
