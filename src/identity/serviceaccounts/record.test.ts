import { fireEvent, screen, waitFor, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findTest } from "../../access/testing";
import { settle } from "../../testing";
import { callsTo, dataOf, refusal, stopApplications } from "../testing";
import { ACCOUNT_MANAGE, ACCOUNT_VIEW, KEY_REVOKE, account, apiKey, startAccounts } from "./testing";

vi.setConfig({ testTimeout: 30_000 });

afterEach(stopApplications);

const access = (bindings: object[] = []) => dataOf({ subject: { kind: "service", id: 21 }, bindings, effective: [], can_manage: true });
const binding = { id: 5, role: { ref: "importer", key: null, id: 3, name: "Importer", description: "", predefined: false, computed: false, attrs: [], holders: 1, permission_count: 1 }, scope: { level: "organization", id: null, name: null }, created_by: null, created_at: "2026-10-01T10:00:00Z" };

function open(permissions: string[], options: { who?: ReturnType<typeof account>; location?: string; answers?: Record<string, never | Parameters<typeof startAccounts>[0]["answers"][string]>; tenants?: false } = {}) {
  const { who = account(), location = "/iam/service-accounts/21", answers = {}, tenants } = options;
  return startAccounts({
    permissions,
    location,
    ...(tenants === false ? { tenants } : {}),
    answers: {
      "GET /v1/iam/service-accounts/21": dataOf(who),
      "GET /v1/iam/service-accounts/21/keys": dataOf({ keys: [apiKey()] }),
      "GET /v1/iam/service-accounts/21/access": access([binding]),
      ...answers,
    },
  });
}
const menu = async () => fireEvent.click(await screen.findByRole("button", { name: "More actions" }));

describe("a service account's record", () => {
  it("has three tabs, counting the live keys, and opens on the account's data", async () => {
    const { target } = await open([ACCOUNT_VIEW]);
    const tabs = within(screen.getAllByRole("tablist")[0] as HTMLElement);
    expect(tabs.getByRole("tab", { name: /General/ })).toBeTruthy();
    expect(tabs.getByRole("tab", { name: /Access/ })).toBeTruthy();
    expect(tabs.getByRole("tab", { name: /API keys/ }).textContent).toContain("2");
    expect(target.querySelector("[data-test=service-general]")).not.toBeNull();
  });

  it("reads who answers for the account, its tenant, who made it and that it has no password", async () => {
    const { target } = await open([ACCOUNT_VIEW]);
    const general = target.querySelector("[data-test=service-general]")!.textContent!;
    for (const text of ["Responsible person", "Ivan Horvat", "Dealer", "Auto Zagreb", "Nightly stock sync", "Ana Anić", "Active", "has no password"]) expect(general).toContain(text);
    expect(target.querySelector("h1")?.textContent).toContain("DMS sync");
  });

  it("says the organization for an account without a tenant", async () => {
    const { target } = await open([ACCOUNT_VIEW], { who: account({ tenant: null }) });
    expect(target.querySelector("[data-test=service-general]")!.textContent).toContain("Organization");
  });

  it("leaves the tenant out when the application has none", async () => {
    const { target } = await open([ACCOUNT_VIEW], { tenants: false });
    expect(target.querySelector("[data-test=service-general]")!.textContent).not.toContain("Auto Zagreb");
    expect(target.querySelector("[data-test=service-general]")!.textContent).not.toContain("Dealer");
  });

  it("shows the access panel of a person for this account, and counts its roles on the tab", async () => {
    const { target, calls } = await open([ACCOUNT_VIEW], { location: "/iam/service-accounts/21?tab=access" });
    await waitFor(() => expect(target.querySelector("[data-test=access-panel]")?.textContent).toContain("Importer"));
    expect(callsTo(calls, "GET", "/v1/iam/service-accounts/21/access")).toHaveLength(1);
    expect(callsTo(calls, "GET", "/v1/iam/users/21/access")).toHaveLength(0);
    expect(within(screen.getAllByRole("tablist")[0] as HTMLElement).getByRole("tab", { name: /Access/ }).textContent).toContain("1");
  });

  it("opens on the tab the URL names, and switches without leaving", async () => {
    const { target } = await open([ACCOUNT_VIEW], { location: "/iam/service-accounts/21?tab=keys" });
    await waitFor(() => expect(target.querySelector("[data-test=api-keys]")?.textContent).toContain("Production"));
    await fireEvent.click(screen.getByRole("tab", { name: /General/ }));
    await settle();
    expect(target.querySelector("[data-test=service-general]")).not.toBeNull();
    expect(target.querySelector("[data-test=api-keys]")).toBeNull();
  });

  it("is a not-found page for an account that is not there", async () => {
    const { target } = await open([ACCOUNT_VIEW], { location: "/iam/service-accounts/404", answers: { "GET /v1/iam/service-accounts/404": refusal(404, "not_found") } });
    expect(target.querySelector("[data-test=service-general]")).toBeNull();
    expect(target.textContent).toMatch(/not found|doesn.t exist/i);
  });

  it("reads the account again when a key was made or revoked, so the count follows", async () => {
    const { calls } = await open([ACCOUNT_VIEW, ACCOUNT_MANAGE, KEY_REVOKE], {
      location: "/iam/service-accounts/21?tab=keys",
      answers: { "POST /v1/iam/service-accounts/21/keys/31/revoke": new Response(null, { status: 204 }) },
    });
    await fireEvent.click(within(await findTest("revoke-key-31")).getByRole("button", { name: "Revoke" }));
    await fireEvent.click((await screen.findAllByRole("button", { name: "Revoke" })).at(-1) as HTMLElement);
    await waitFor(() => expect(callsTo(calls, "GET", "/v1/iam/service-accounts/21").length).toBeGreaterThanOrEqual(2));
  });
});

describe("a service account's record: actions", () => {
  it("gives whoever manages Edit and Deactivate", async () => {
    await open([ACCOUNT_VIEW, ACCOUNT_MANAGE]);
    expect(screen.getByRole("button", { name: "Edit account" })).toBeTruthy();
    await menu();
    expect(await screen.findByRole("menuitem", { name: /Deactivate account/ })).toBeTruthy();
  });

  it("gives a reader none, and a deactivated account none", async () => {
    await open([ACCOUNT_VIEW]);
    expect(screen.queryByRole("button", { name: "Edit account" })).toBeNull();
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
    stopApplications();
    const { target } = await open([ACCOUNT_VIEW, ACCOUNT_MANAGE], { who: account({ deactivated_at: "2026-09-30T08:00:00Z" }) });
    expect(screen.queryByRole("button", { name: "Edit account" })).toBeNull();
    expect(target.textContent).toContain("Deactivated");
  });

  it("asks before deactivating, then deactivates and shows the account as deactivated", async () => {
    const { calls, target } = await open([ACCOUNT_VIEW, ACCOUNT_MANAGE], { answers: { "POST /v1/iam/service-accounts/21/deactivate": dataOf(account({ deactivated_at: "2026-10-15T08:00:00Z", active_keys: 0 })) } });
    await menu();
    await fireEvent.click(await screen.findByRole("menuitem", { name: /Deactivate account/ }));
    expect(await screen.findByText(/stop working at once/)).toBeTruthy();
    expect(callsTo(calls, "POST", "/v1/iam/service-accounts/21/deactivate")).toHaveLength(0);
    await fireEvent.click(screen.getAllByRole("button", { name: "Deactivate account" }).at(-1) as HTMLElement);
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/iam/service-accounts/21/deactivate")).toHaveLength(1));
    expect(await screen.findByText("Service account deactivated")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Edit account" })).toBeNull());
    expect(target.textContent).toContain("Deactivated");
  });

  it("says why a deactivation was refused", async () => {
    await open([ACCOUNT_VIEW, ACCOUNT_MANAGE], { answers: { "POST /v1/iam/service-accounts/21/deactivate": refusal(403, "authz.forbidden") } });
    await menu();
    await fireEvent.click(await screen.findByRole("menuitem", { name: /Deactivate account/ }));
    await fireEvent.click((await screen.findAllByRole("button", { name: "Deactivate account" })).at(-1) as HTMLElement);
    expect(await screen.findByText("You are not allowed to make this change in that place.")).toBeTruthy();
    expect(screen.queryByText("Service account deactivated")).toBeNull();
    expect(screen.getByRole("button", { name: "Edit account" })).toBeTruthy();
  });
});
