import { fireEvent, screen, waitFor, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../i18n/en.json";
import { settle } from "../../testing";
import { callsTo, dataOf, stopApplications } from "../testing";
import { ACCOUNT_MANAGE, ACCOUNT_VIEW, account, choose, person, startAccounts } from "./testing";

// The first screen of a file loads its route chunks through the transformer: slow on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

afterEach(stopApplications);

const accounts = [
  account(),
  account({ id: 22, name: "Website", description: "", tenant: null, owner: { id: 5, name: "Eva Marić" }, active_keys: 1, last_used_at: null }),
  account({ id: 23, name: "Old robot", description: "Retired", active_keys: 0, deactivated_at: "2026-09-30T08:00:00Z" }),
];

const open = (permissions: string[], options: Partial<Parameters<typeof startAccounts>[0]> = {}) =>
  startAccounts({ permissions, location: "/iam/service-accounts", answers: { "GET /v1/iam/service-accounts": dataOf({ service_accounts: accounts }) }, ...options });

const rowOf = (target: HTMLElement, id: number) => target.querySelector(`[data-service-account="${id}"]`) as HTMLElement;

describe("the service accounts list", () => {
  it("lists the active accounts: whose they are, who answers for them, their live keys and last call", async () => {
    const { target } = await open([ACCOUNT_VIEW]);
    const dms = rowOf(target, 21);
    expect(dms.textContent).toContain("DMS sync");
    expect(dms.textContent).toContain("Nightly stock sync");
    expect(dms.textContent).toContain("Auto Zagreb");
    expect(dms.textContent).toContain("Ivan Horvat");
    expect(dms.textContent).toContain("Last call:");
    expect(dms.textContent).toContain("Active keys: 2");
    // No tenant: the whole organization; no call yet.
    const website = rowOf(target, 22);
    expect(website.textContent).toContain("Organization");
    expect(website.textContent).toContain("Never used");
    expect(rowOf(target, 23)).toBeNull();
  });

  it("counts the views under the search, and shows the deactivated ones in theirs", async () => {
    const { target } = await open([ACCOUNT_VIEW]);
    expect(screen.getByRole("tab", { name: /Active/ }).textContent).toContain("2");
    expect(screen.getByRole("tab", { name: /Inactive/ }).textContent).toContain("1");
    expect(screen.getByRole("tab", { name: /All/ }).textContent).toContain("3");
    await fireEvent.click(screen.getByRole("tab", { name: /Inactive/ }));
    await settle();
    expect(rowOf(target, 23).textContent).toContain("Deactivated");
    expect(rowOf(target, 23).textContent).not.toContain("Active keys");
    expect(rowOf(target, 21)).toBeNull();
  });

  it("searches by name, description and the person who answers", async () => {
    const { target } = await open([ACCOUNT_VIEW]);
    await fireEvent.update(screen.getByLabelText("Search service accounts"), "eva");
    await settle();
    expect(rowOf(target, 22)).not.toBeNull();
    expect(rowOf(target, 21)).toBeNull();
    await fireEvent.update(screen.getByLabelText("Search service accounts"), "stock");
    await settle();
    expect(rowOf(target, 21)).not.toBeNull();
    expect(screen.getByRole("tab", { name: /All/ }).textContent).toContain("1");
    await fireEvent.update(screen.getByLabelText("Search service accounts"), "nothing like this");
    await settle();
    expect(target.querySelector("[data-test=service-accounts-empty]")?.textContent).toBe("No service accounts.");
  });

  it("leaves the tenant out when the application has none", async () => {
    const { target } = await open([ACCOUNT_VIEW], { tenants: false });
    expect(rowOf(target, 21).textContent).toContain("Ivan Horvat");
    expect(rowOf(target, 21).textContent).not.toContain("Auto Zagreb");
    expect(rowOf(target, 22).textContent).not.toContain("Organization");
  });

  it("links a row to the account's record", async () => {
    const { target, application } = await open([ACCOUNT_VIEW], {
      answers: { "GET /v1/iam/service-accounts": dataOf({ service_accounts: accounts }), "GET /v1/iam/service-accounts/21": dataOf(account()), "GET /v1/iam/service-accounts/21/keys": dataOf({ keys: [] }) },
    });
    await fireEvent.click(within(rowOf(target, 21)).getByText("DMS sync"));
    await waitFor(() => expect(application.router.currentRoute.value.name).toBe("serviceaccounts.record"));
    expect(application.router.currentRoute.value.params.id).toBe("21");
  });

  it("says when the server has none", async () => {
    const { target } = await open([ACCOUNT_VIEW], { answers: { "GET /v1/iam/service-accounts": dataOf({ service_accounts: [] }) } });
    expect(target.querySelector("[data-test=service-accounts-empty]")).not.toBeNull();
  });

  it("offers a new account only to whoever manages them", async () => {
    await open([ACCOUNT_VIEW]);
    expect(screen.queryByRole("button", { name: "New service account" })).toBeNull();
  });

  it("is closed to someone without iam.serviceaccount:view", async () => {
    const { target, calls } = await open([]);
    expect(target.textContent).toContain(en.core.no_access.title);
    expect(callsTo(calls, "GET", "/v1/iam/service-accounts")).toHaveLength(0);
  });

  it("opens a new account where its roles are given", async () => {
    const created = account({ id: 40, name: "Fresh", active_keys: 0 });
    const { application, calls } = await open([ACCOUNT_VIEW, ACCOUNT_MANAGE], {
      answers: {
        "GET /v1/iam/service-accounts": dataOf({ service_accounts: accounts }),
        "GET /v1/iam/users": dataOf({ data: [{ ...person, login: "ivan", email: "", phone: "", locale: "en", active: true, status: "active", last_sign_in: null, locked_until: null, created_at: "2026-09-01T08:00:00Z" }], total: 1, per_page: 500, current_page: 1, last_page: 1, from: 1, to: 1 }),
        "POST /v1/iam/service-accounts": dataOf(created),
        "GET /v1/iam/service-accounts/40": dataOf(created),
        "GET /v1/iam/service-accounts/40/access": dataOf({ subject: { kind: "service", id: 40 }, bindings: [], effective: [], can_manage: true }),
      },
    });
    await fireEvent.click(screen.getByRole("button", { name: "New service account" }));
    await settle();
    await fireEvent.update(screen.getByLabelText(/^Name/), "Fresh");
    await choose(/Responsible person/, "Ivan Horvat");
    await choose(/Dealer/, "Auto Zagreb");
    await fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/iam/service-accounts")).toHaveLength(1));
    await waitFor(() => expect(application.router.currentRoute.value.name).toBe("serviceaccounts.record"));
    expect(application.router.currentRoute.value.query.tab).toBe("access");
    await waitFor(() => expect(callsTo(calls, "GET", "/v1/iam/service-accounts/40/access")).toHaveLength(1));
  });
});
