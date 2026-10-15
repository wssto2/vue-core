import { fireEvent, screen, waitFor } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { settle } from "../../testing";
import { callsTo, dataOf, refusal, stopApplications } from "../testing";
import { ACCOUNT_MANAGE, ACCOUNT_VIEW, account, choose, offered, person, startAccounts } from "./testing";

vi.setConfig({ testTimeout: 30_000 });

afterEach(stopApplications);

const people = [{ ...person, login: "ivan", email: "", phone: "", locale: "en", active: true, status: "active", last_sign_in: null, locked_until: null, created_at: "2026-09-01T08:00:00Z" }];
const answers = {
  "GET /v1/iam/service-accounts": dataOf({ service_accounts: [] }),
  "GET /v1/iam/users": dataOf({ data: people, total: 1, per_page: 500, current_page: 1, last_page: 1, from: 1, to: 1 }),
};
const PEOPLE_AND_TENANTS = [ACCOUNT_VIEW, ACCOUNT_MANAGE];

async function openNew(options: Partial<Parameters<typeof startAccounts>[0]> = {}) {
  const started = await startAccounts({ permissions: PEOPLE_AND_TENANTS, location: "/iam/service-accounts", answers, ...options });
  await fireEvent.click(screen.getByRole("button", { name: "New service account" }));
  await settle();
  return started;
}
const body = (calls: Parameters<typeof callsTo>[0], method: string, path: string) => JSON.parse(String(callsTo(calls, method, path)[0]!.init.body));
const fillName = (value: string) => fireEvent.update(screen.getByLabelText(/^Name/), value);
const save = async () => {
  await fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await settle();
};

describe("a new service account", () => {
  it("reads the people and the tenants only once the dialog opens, and only the active people", async () => {
    const { calls } = await startAccounts({ permissions: PEOPLE_AND_TENANTS, location: "/iam/service-accounts", answers });
    expect(callsTo(calls, "GET", "/v1/iam/users")).toHaveLength(0);
    await fireEvent.click(screen.getByRole("button", { name: "New service account" }));
    await settle();
    const asked = callsTo(calls, "GET", "/v1/iam/users")[0]!.url;
    expect(asked).toContain("view=active");
    expect(asked).toContain("per_page=500");
  });

  it("offers the whole organization to whoever holds the permission there, and starts at it", async () => {
    await openNew();
    const field = screen.getByLabelText(/Dealer/);
    expect(field.textContent).toContain("Organization");
    expect(await offered(/Dealer/)).toEqual(["Organization", "Auto Zagreb", "Auto Split"]);
  });

  it("asks for a name and a responsible person before any request", async () => {
    const { calls } = await openNew();
    await save();
    expect(screen.getAllByText("Required.").length).toBeGreaterThanOrEqual(2);
    expect(callsTo(calls, "POST", "/v1/iam/service-accounts")).toHaveLength(0);
  });

  it("makes the organization's account with no tenant, and sends the attempt's idempotency key", async () => {
    const { calls } = await openNew({ answers: { ...answers, "POST /v1/iam/service-accounts": dataOf(account({ id: 40, tenant: null })), "GET /v1/iam/service-accounts/40": dataOf(account({ id: 40, tenant: null })) } });
    await fillName("  For all  ");
    await choose(/Responsible person/, "Ivan Horvat");
    await save();
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/iam/service-accounts")).toHaveLength(1));
    expect(body(calls, "POST", "/v1/iam/service-accounts")).toEqual({ name: "For all", description: "", tenant_id: null, owner_id: 4 });
    expect(new Headers(callsTo(calls, "POST", "/v1/iam/service-accounts")[0]!.init.headers).get("Idempotency-Key")).toBeTruthy();
  });

  it("makes a tenant's account with that tenant", async () => {
    const { calls } = await openNew({ answers: { ...answers, "POST /v1/iam/service-accounts": dataOf(account({ id: 40 })), "GET /v1/iam/service-accounts/40": dataOf(account({ id: 40 })) } });
    await fillName("DMS");
    await fireEvent.update(screen.getByLabelText(/Description/), "Stock");
    await choose(/Dealer/, "Auto Split");
    await choose(/Responsible person/, "Ivan Horvat");
    await save();
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/iam/service-accounts")).toHaveLength(1));
    expect(body(calls, "POST", "/v1/iam/service-accounts")).toEqual({ name: "DMS", description: "Stock", tenant_id: 2, owner_id: 4 });
  });

  it("holds an administrator of one tenant to a tenant: no organization choice, and one is required", async () => {
    const { calls } = await openNew({ scope: { level: "dealer", id: 1 } });
    await fillName("DMS");
    await choose(/Responsible person/, "Ivan Horvat");
    expect(await offered(/Dealer/)).toEqual(["Auto Zagreb", "Auto Split"]);
    await fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await save();
    expect(screen.getAllByText("Required.").length).toBeGreaterThanOrEqual(1);
    expect(callsTo(calls, "POST", "/v1/iam/service-accounts")).toHaveLength(0);
  });

  it("has no tenant field when the application has no tenants", async () => {
    const { calls } = await openNew({ tenants: false, answers: { ...answers, "POST /v1/iam/service-accounts": dataOf(account({ id: 40, tenant: null })), "GET /v1/iam/service-accounts/40": dataOf(account({ id: 40, tenant: null })) } });
    expect(screen.queryByLabelText(/Dealer/)).toBeNull();
    await fillName("DMS");
    await choose(/Responsible person/, "Ivan Horvat");
    await save();
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/iam/service-accounts")).toHaveLength(1));
    expect(body(calls, "POST", "/v1/iam/service-accounts").tenant_id).toBeNull();
  });

  it("says which rule refused the account, and stays open", async () => {
    await openNew({ answers: { ...answers, "POST /v1/iam/service-accounts": refusal(403, "authz.escalation") } });
    await fillName("DMS");
    await choose(/Responsible person/, "Ivan Horvat");
    await save();
    expect(document.body.querySelector("[data-test=service-account-form]")).not.toBeNull();
    expect(document.body.textContent).toContain("so you cannot give it");
  });
});

describe("editing a service account", () => {
  it("opens filled in and PUTs the change", async () => {
    const saved = account({ name: "DMS Zagreb" });
    const { calls } = await startAccounts({
      permissions: PEOPLE_AND_TENANTS,
      location: "/iam/service-accounts/21",
      answers: { ...answers, "GET /v1/iam/service-accounts/21": dataOf(account()), "GET /v1/iam/service-accounts/21/keys": dataOf({ keys: [] }), "PUT /v1/iam/service-accounts/21": dataOf(saved) },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Edit account" }));
    await settle();
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe("DMS sync");
    await fireEvent.update(screen.getByLabelText(/^Name/), "DMS Zagreb");
    await save();
    await waitFor(() => expect(callsTo(calls, "PUT", "/v1/iam/service-accounts/21")).toHaveLength(1));
    expect(body(calls, "PUT", "/v1/iam/service-accounts/21")).toEqual({ name: "DMS Zagreb", description: "Nightly stock sync", tenant_id: 1, owner_id: 4 });
    expect(await screen.findByText("Service account saved")).toBeTruthy();
    expect(document.body.textContent).toContain("DMS Zagreb");
  });
});
