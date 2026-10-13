import { fireEvent, screen, waitFor, within } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { jsonResponse, settle } from "../testing";
import { accessPermissions } from "./context";
import { choose, data, findTest, queryAllTest, queryTest, refusal, role, seller, startAccess, summary, support, type Started } from "./testing";

let running: Started | null = null;
afterEach(() => {
  running?.dispose();
  running = null;
  document.body.innerHTML = ""; // teleported menus and dialogs outlive their application
});

const sellerRow = summary({ ref: "seller", key: "seller", name: "Seller", predefined: true, permission_count: 1 });
const supportRow = summary({ ref: "7", id: 7, name: "Support", description: "Answers customers", holders: 2, permission_count: 2 });
const all = [accessPermissions.viewRoles, accessPermissions.manageRoles, accessPermissions.deleteRoles];

describe("the roles list", () => {
  // The first render loads the whole access screen, which takes seconds when the full suite loads the machine.
  it("lists every role with its kind and holders, and filters by kind and search", { timeout: 30_000 }, async () => {
    running = await startAccess({ "GET /v1/iam/roles": data({ roles: [sellerRow, supportRow] }) }, all, "/iam/roles");
    await screen.findByText("Seller", {}, { timeout: 10_000 });
    expect(screen.getByText("Support")).toBeTruthy();
    expect(screen.getByText("Predefined", { selector: "span" })).toBeTruthy();
    expect(queryAllTest("role-holders").map((cell) => cell.textContent)).toEqual(["People: 0", "People: 2"]);

    await fireEvent.click(screen.getByRole("tab", { name: /^Custom/ }));
    await waitFor(() => expect(screen.queryByText("Seller")).toBeNull());
    await fireEvent.click(screen.getByRole("tab", { name: /^All/ }));
    await screen.findByText("Seller");
    await fireEvent.update(screen.getByPlaceholderText("Search roles"), "answers");
    await waitFor(() => expect(screen.queryByText("Seller")).toBeNull());
    expect(screen.getByText("Support")).toBeTruthy();
  });

  it("offers a new role only to who may manage roles", async () => {
    running = await startAccess({ "GET /v1/iam/roles": data({ roles: [] }) }, [accessPermissions.viewRoles], "/iam/roles");
    await findTest("roles-empty");
    expect(screen.queryByRole("button", { name: "New role" })).toBeNull();
  });

  it("is closed to who may not view roles", async () => {
    running = await startAccess({ "GET /v1/iam/roles": data({ roles: [] }) }, [], "/iam/roles");
    await settle();
    expect(running.calls).toHaveLength(0);
    expect(queryTest("roles-index")).toBeNull();
  });
});

describe("a role's page", () => {
  const server = (extra: Record<string, never> = {}) => ({
    "GET /v1/iam/roles/7": data(support),
    "GET /v1/iam/roles/7/holders": data({ holders: [{ subject: { kind: "user", id: 4 }, name: "Ana Anić", scope: { level: "organization", id: null, name: null } }] }),
    ...extra,
  });

  it("shows the editor with the permission tree and who holds the role", async () => {
    running = await startAccess(server(), all, "/iam/roles/7");
    await screen.findByDisplayValue("Support");
    expect(queryTest("tree-count-crm")?.textContent).toBe("2 / 3");
    expect(screen.getByRole("switch", { name: "View customers" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("switch", { name: "View leads" }).getAttribute("aria-checked")).toBe("false");
    expect(await screen.findByText("Ana Anić")).toBeTruthy();
  });

  it("switching a permission on switches on what it needs, and saves the role with its grants", async () => {
    const saved = role({ ...support, grants: [{ permission: "crm.lead:view", qualifier: "all" }] });
    let body: unknown = null;
    running = await startAccess(server({ "PUT /v1/iam/roles/7": (call: { init: RequestInit }) => ((body = JSON.parse(String(call.init.body))), data(saved)) } as never), all, "/iam/roles/7");
    await screen.findByDisplayValue("Support");
    await fireEvent.click(screen.getByRole("switch", { name: "View customers" })); // off: takes "Edit customers" with it
    expect(screen.getByRole("switch", { name: "Edit customers" }).getAttribute("aria-checked")).toBe("false");
    await fireEvent.click(screen.getByRole("switch", { name: "View leads" }));
    await fireEvent.click(screen.getByRole("button", { name: "Save role" }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toEqual({ name: "Support", description: "Answers customers", grants: [{ permission: "crm.lead:view", qualifier: "all" }], attrs: [] });
  });

  it("says which rule refused a save, in words", async () => {
    running = await startAccess(server({ "PUT /v1/iam/roles/7": refusal(403, "authz.escalation") } as never), all, "/iam/roles/7");
    await screen.findByDisplayValue("Support");
    await fireEvent.click(screen.getByRole("switch", { name: "View leads" }));
    await fireEvent.click(screen.getByRole("button", { name: "Save role" }));
    expect(await screen.findByText("That role has permissions you do not hold yourself, so you cannot give it.")).toBeTruthy();
  });

  it("says every problem of a role the server refused as invalid, in the go-core v1.8.0 shape", async () => {
    const invalid = jsonResponse(400, { success: false, error: "invalid", code: "authz.invalid", params: { problems: [{ code: "organization_only", permission: "crm.lead:view" }, { code: "vehicle_kind_conflict", permission: "crm.customer:update" }] } });
    running = await startAccess(server({ "PUT /v1/iam/roles/7": invalid } as never), all, "/iam/roles/7", { problems: { vehicle_kind_conflict: "roles.vehicle_kind_conflict" } });
    await screen.findByDisplayValue("Support");
    await fireEvent.click(screen.getByRole("switch", { name: "View leads" }));
    await fireEvent.click(screen.getByRole("button", { name: "Save role" }));
    expect(await screen.findByText("View leads can only be given for the whole organization. Edit customers: this role mixes vehicle kinds.")).toBeTruthy();
  });

  it("only reads a predefined role, and offers Copy", async () => {
    running = await startAccess({ "GET /v1/iam/roles/seller": data(seller), "GET /v1/iam/roles/seller/holders": data({ holders: [] }) }, all, "/iam/roles/seller");
    await findTest("role-predefined-note");
    expect(screen.getByRole("switch", { name: "View leads" }).hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("button", { name: "Save role" })).toBeNull();
    expect(screen.getByText("Nobody has this role now.")).toBeTruthy();
  });

  it("compares a predefined role with any other, the server answering for the standard one", async () => {
    running = await startAccess(
      { "GET /v1/iam/roles/seller": data(seller), "GET /v1/iam/roles/seller/holders": data({ holders: [] }), "GET /v1/iam/roles": data({ roles: [sellerRow, supportRow] }), "GET /v1/iam/roles/seller/compare": data({ only_in_role: [], only_in_other: [], different: [] }) },
      all,
      "/iam/roles/seller",
    );
    await findTest("role-predefined-note");
    await fireEvent.click(screen.getAllByRole("button", { name: /^More/ })[0] as HTMLElement);
    expect(screen.queryByRole("menuitem", { name: "Replace" })).toBeNull();
    await fireEvent.click(await screen.findByRole("menuitem", { name: "Compare with another role" }));
    const dialog = await findTest("role-compare");
    await choose("Other role", "Support");
    expect(await within(dialog).findByText("The roles do not differ.")).toBeTruthy();
    expect(running.calls.some((call) => call.url.includes("/roles/seller/compare?with=7"))).toBe(true);
  });

  it("switches on what a loaded role lacks of what its permissions need, and says so", async () => {
    const lacking = role({ ...support, grants: [{ permission: "crm.customer:update", qualifier: "own" }] });
    running = await startAccess(server({ "GET /v1/iam/roles/7": data(lacking) } as never), all, "/iam/roles/7");
    expect((await findTest("role-completed-note")).textContent).toContain("View customers");
    expect(screen.getByRole("switch", { name: "View customers" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
  });

  it("holds the whose of a record type once, for every permission of it", async () => {
    running = await startAccess(server(), all, "/iam/roles/7");
    await screen.findByDisplayValue("Support");
    const panel = queryTest("tree-panel-crm") as HTMLElement;
    await fireEvent.click(within(panel).getByRole("button", { name: "All" }));
    expect(within(panel).getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("a new role", () => {
  it("starts from another role with ?copy=, and creates a new one", async () => {
    let body: { name?: string } = {};
    running = await startAccess(
      { "GET /v1/iam/roles/seller": data(seller), "POST /v1/iam/roles": (call: { init: RequestInit }) => ((body = JSON.parse(String(call.init.body))), data(role({ ref: "9", id: 9, name: "Seller (copy)" }))), "GET /v1/iam/roles/9": data(role({ ref: "9", id: 9, name: "Seller (copy)" })), "GET /v1/iam/roles/9/holders": data({ holders: [] }) },
      all,
      "/iam/roles/new?copy=seller",
    );
    expect(await screen.findByDisplayValue("Seller (copy)")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Save role" }));
    await waitFor(() => expect(running?.application.router.currentRoute.value.name).toBe("access.role"));
    expect(body.name).toBe("Seller (copy)");
  });
});

describe("a custom role's actions", () => {
  const server = (extra: Record<string, unknown> = {}) => ({
    "GET /v1/iam/roles/7": data(support),
    "GET /v1/iam/roles/7/holders": data({ holders: [] }),
    "GET /v1/iam/roles": data({ roles: [sellerRow, supportRow] }),
    ...extra,
  });
  const openAction = async (action: string) => {
    await screen.findByDisplayValue("Support");
    await fireEvent.click(screen.getAllByRole("button", { name: /^More/ })[0] as HTMLElement);
    await fireEvent.click(await screen.findByRole("menuitem", { name: action }));
  };

  it("compares it with another role", async () => {
    running = await startAccess(
      server({ "GET /v1/iam/roles/7/compare": data({ only_in_role: [{ permission: "crm.customer:view", qualifier: "own" }], only_in_other: [{ permission: "crm.lead:view", qualifier: "all" }], different: [] }) }),
      all,
      "/iam/roles/7",
    );
    await openAction("Compare with another role");
    const dialog = await findTest("role-compare");
    await choose("Other role", "Seller");
    expect(await within(dialog).findByText("Only in this role (1)")).toBeTruthy();
    expect(within(dialog).getByText("Only in the other role (1)")).toBeTruthy();
    expect(running.calls.some((call) => call.url.includes("/compare?with=seller"))).toBe(true);
  });

  it("offers every other role in the compare dialog, custom ones too, and never the role itself", async () => {
    const other = summary({ ref: "9", id: 9, name: "Night shift" });
    running = await startAccess(server({ "GET /v1/iam/roles": data({ roles: [sellerRow, supportRow, other] }) }), all, "/iam/roles/7");
    await openAction("Compare with another role");
    await findTest("role-compare");
    const named = [...document.querySelectorAll("label")].find((element) => element.textContent?.trim().startsWith("Other role"));
    (named?.htmlFor ? document.getElementById(named.htmlFor) : null)?.click();
    const options = (await screen.findAllByRole("option")).map((element) => element.textContent?.trim());
    expect(options).toEqual(["Seller", "Night shift"]);
  });

  it("replaces it with a predefined role, saying how many people move", async () => {
    let body: unknown = null;
    running = await startAccess(server({ "POST /v1/iam/roles/7/replace": (call: { init: RequestInit }) => ((body = JSON.parse(String(call.init.body))), data({ rebound: 2 })) }), all, "/iam/roles/7");
    await openAction("Replace");
    await findTest("role-replace");
    expect(document.body.textContent).toContain("People who move to the predefined role: 2.");
    await choose("Replace with predefined role", "Seller");
    await fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    await waitFor(() => expect(body).toEqual({ with: "seller" }));
  });

  it("deletes it, and says why when somebody still holds it", async () => {
    running = await startAccess(server({ "DELETE /v1/iam/roles/7": refusal(409, "authz.role_in_use") }), all, "/iam/roles/7");
    await openAction("Delete role");
    await fireEvent.click(await screen.findByRole("button", { name: "Delete role" }));
    expect(await screen.findByText("The role is still given to people. Replace it first or take it from their access.")).toBeTruthy();
    expect(running.application.router.currentRoute.value.name).toBe("access.role");
  });

  it("deletes it and returns to the list", async () => {
    running = await startAccess(server({ "DELETE /v1/iam/roles/7": new Response(null, { status: 204 }) }), all, "/iam/roles/7");
    await openAction("Delete role");
    await fireEvent.click(await screen.findByRole("button", { name: "Delete role" }));
    await waitFor(() => expect(running?.application.router.currentRoute.value.name).toBe("access.roles"));
  });

  it("is not offered Delete without its own permission", async () => {
    running = await startAccess(server(), [accessPermissions.viewRoles, accessPermissions.manageRoles], "/iam/roles/7");
    await screen.findByDisplayValue("Support");
    await fireEvent.click(screen.getAllByRole("button", { name: /^More/ })[0] as HTMLElement);
    expect(screen.queryByRole("menuitem", { name: "Delete role" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Replace" })).toBeTruthy();
  });
});
