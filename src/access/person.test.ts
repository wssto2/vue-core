import { fireEvent, screen, waitFor, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { defineFeature } from "../app";
import type { Binding, Role, Scope, ScopeOptions, SubjectAccess } from "../modules/access/entities";
import { toast } from "../overlay";
import { mockMedia, settle, type Answer } from "../testing";
import { accessPermissions } from "./context";
import PersonAccess from "./PersonAccess.vue";
import { choose, data, findTest, queryTest, refusal, seller, startAccess, summary, support, type Started } from "./testing";

afterEach(() => {
  running?.dispose();
  running = null;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const root: Scope = { level: "organization", id: null, name: null };
const binding = (id: number, row: ReturnType<typeof summary>, scope = root): Binding => ({ id, role: row, scope, created_by: null, created_at: "2026-10-01T10:00:00Z" });
const supportRow = summary({ ref: "7", id: 7, name: "Support", permission_count: 2 });
const sellerRow = summary({ ref: "seller", key: "seller", name: "Seller", predefined: true });

const access = (extra: Partial<SubjectAccess> = {}): SubjectAccess => ({
  subject: { kind: "user", id: 4 },
  bindings: [binding(11, supportRow)],
  effective: [{ permission: "crm.customer:view", unavailable: false, grants: [{ qualifier: "own", scope: root, attrs: [], binding_id: 11, role_key: "", role_name: "Support" }] }],
  can_manage: true,
  ...extra,
});

// The person's page of the application: the access panel as a section of it.
const personPage = defineComponent({ render: () => h(PersonAccess, { subject: { kind: "user", id: 4 }, name: "Ana" }) });
const personFeature = defineFeature({ id: "person", routes: [{ name: "person", path: "/people/4", component: personPage }] });

let running: Started | null = null;
async function mount(answers: Record<string, Answer>, permissions: readonly string[] = [accessPermissions.viewAccess, accessPermissions.manageBindings]) {
  running = await startAccess(answers, permissions, "/people/4", {}, [personFeature]);
  return running;
}

describe("a person's roles", () => {
  it("shows each role with where it applies, and what the person can do with the reasons", async () => {
    await mount({ "GET /v1/iam/users/4/access": data(access()) });
    expect(await screen.findByText("Support")).toBeTruthy();
    expect(queryTest("binding-scope")?.textContent).toBe("Organization");
    expect(screen.getByText("What Ana can do")).toBeTruthy();
    expect(queryTest("effective-actions")?.textContent).toBe("View customers");
    expect(queryTest("effective-sources")?.textContent).toBe("from: Support (own)");
    expect(queryTest("effective-reach")?.textContent).toBe("Own · Organization");
    await fireEvent.click(within(queryTest("why-crm_customer") as HTMLElement).getByRole("button", { name: "Why" }));
    expect(queryTest("effective-why")?.textContent).toContain("Support · Own · Organization");
  });

  it("words a role's constraints as the application did, and leaves one it gave no text for as it is", async () => {
    const constrained = summary({ ref: "7", id: 7, name: "Support", attrs: [{ attribute: "vehicle_kind", values: ["used"] }, { attribute: "region", values: ["north"] }] });
    running = await startAccess({ "GET /v1/iam/users/4/access": data(access({ bindings: [binding(11, constrained)] })) }, [accessPermissions.viewAccess], "/people/4", { roleConstraints: [{ attribute: "vehicle_kind", labelKey: "roles.vehicle_kind", options: [{ value: "new", labelKey: "roles.kind.new" }, { value: "used", labelKey: "roles.kind.used" }] }] }, [personFeature]);
    expect(await screen.findByText(/Used only/)).toBeTruthy();
    expect(screen.getByText(/region: north/)).toBeTruthy();
    expect(screen.queryByText(/vehicle_kind/)).toBeNull();
  });

  it("says what a person without roles can do: nothing", async () => {
    await mount({ "GET /v1/iam/users/4/access": data(access({ bindings: [], effective: [] })) });
    expect(await screen.findByText("No roles")).toBeTruthy();
    expect(screen.getByText("Without roles there are no permissions.")).toBeTruthy();
  });

  it("offers Add and Remove only when the server says the actor may manage them, and the permission is held", async () => {
    await mount({ "GET /v1/iam/users/4/access": data(access({ can_manage: false })) });
    await screen.findByText("Support");
    expect(queryTest("add-role")).toBeNull();
    expect(queryTest("remove-binding-11")).toBeNull();
  });

  it("does not offer them without the permission to manage bindings, whatever the server says", async () => {
    await mount({ "GET /v1/iam/users/4/access": data(access()) }, [accessPermissions.viewAccess]);
    await screen.findByText("Support");
    expect(queryTest("add-role")).toBeNull();
    expect(queryTest("remove-binding-11")).toBeNull();
  });

  it("removes a role after asking, and reads the access again", async () => {
    let reads = 0;
    const { calls } = await mount({ "GET /v1/iam/users/4/access": () => (reads++ === 0 ? data(access()) : data(access({ bindings: [], effective: [] }))), "DELETE /v1/iam/users/4/bindings/11": new Response(null, { status: 204 }) });
    await screen.findByText("Support");
    await fireEvent.click(within(queryTest("remove-binding-11") as HTMLElement).getByRole("button", { name: "Remove" }));
    expect(await screen.findByText("Ana will no longer have the role “Support” (Organization).")).toBeTruthy();
    await fireEvent.click(screen.getAllByRole("button", { name: "Remove" }).at(-1) as HTMLElement);
    expect(await screen.findByText("No roles")).toBeTruthy();
    expect(calls.map((call) => `${call.method} ${call.url}`)).toContain("DELETE /v1/iam/users/4/bindings/11");
  });

  it("says why a removal was refused: nobody removes their own last access", async () => {
    const error = vi.spyOn(toast, "error");
    await mount({ "GET /v1/iam/users/4/access": data(access()), "DELETE /v1/iam/users/4/bindings/11": refusal(403, "authz.last_admin") });
    await screen.findByText("Support");
    await fireEvent.click(within(queryTest("remove-binding-11") as HTMLElement).getByRole("button", { name: "Remove" }));
    await fireEvent.click((await screen.findAllByRole("button", { name: "Remove" })).at(-1) as HTMLElement);
    await waitFor(() => expect(error.mock.calls[0]?.[0]).toBe("You cannot remove your own last access to roles and users."));
  });
});

describe("a person out of reach", () => {
  it("answers 404 like a person that does not exist: the not-found state, no error banner, no toast", async () => {
    const error = vi.spyOn(toast, "error");
    await mount({ "GET /v1/iam/users/4/access": refusal(404, "") });
    expect(await findTest("access-not-found")).toBeTruthy();
    expect(screen.getByText("Not found")).toBeTruthy();
    expect(document.querySelector('[data-async="failed"]')).toBeNull();
    expect(error).not.toHaveBeenCalled();
  });
});

describe("adding a role", () => {
  const bindable = (roles: Role[]) => data({ roles });

  it("asks nothing about where in an application with one level, and binds at the root", async () => {
    let body: unknown = null;
    const scopes: ScopeOptions = { root_level: "organization", root: true, places: [] };
    const { calls } = await mount({
      "GET /v1/iam/users/4/access": data(access({ bindings: [], effective: [] })),
      "GET /v1/iam/users/4/scopes": data(scopes),
      "GET /v1/iam/bindable-roles": bindable([seller, support]),
      "POST /v1/iam/users/4/bindings": (call: { init: RequestInit }) => ((body = JSON.parse(String(call.init.body))), data(binding(12, sellerRow))),
    });
    await screen.findByText("No roles");
    await fireEvent.click(within(queryTest("add-role") as HTMLElement).getByRole("button", { name: "Add role" }));
    await findTest("bindable-roles");
    expect(screen.queryByText("Where it applies")).toBeNull(); // no scope picker at all
    expect(calls.some((call) => call.url.startsWith("/v1/iam/bindable-roles?level=organization"))).toBe(true);
    await fireEvent.click(screen.getByRole("option", { name: /Seller/ }).querySelector("button") as HTMLElement);
    expect((await findTest("chosen-role")).textContent).toContain("Seller");
    await fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(body).toEqual({ role_ref: "seller", level: "organization", scope_id: null }));
  });

  it("asks where first when the hierarchy has levels: the level, then the places down to it, and offers the roles of that place", async () => {
    let body: unknown = null;
    const scopes: ScopeOptions = {
      root_level: "organization",
      root: true,
      places: [
        { level: "dealer", id: 3, name: "Auto Zagreb", parent_level: "organization", parent_id: null },
        { level: "location", id: 7, name: "Zagreb Sjever", parent_level: "dealer", parent_id: 3 },
        { level: "location", id: 8, name: "Zagreb Jug", parent_level: "dealer", parent_id: 3 },
      ],
    };
    const { calls } = await mount({
      "GET /v1/iam/users/4/access": data(access({ bindings: [], effective: [] })),
      "GET /v1/iam/users/4/scopes": data(scopes),
      "GET /v1/iam/bindable-roles": bindable([support]),
      "POST /v1/iam/users/4/bindings": (call: { init: RequestInit }) => ((body = JSON.parse(String(call.init.body))), data(binding(12, supportRow, { level: "location", id: 8, name: "Zagreb Jug" }))),
    });
    await screen.findByText("No roles");
    await fireEvent.click(within(queryTest("add-role") as HTMLElement).getByRole("button", { name: "Add role" }));
    await screen.findByText("Where it applies");
    // The usual choice, the whole dealer, is made for the person; the only dealer too.
    await findTest("bindable-roles");
    expect(calls.some((call) => call.url.startsWith("/v1/iam/bindable-roles?level=dealer&scope_id=3"))).toBe(true);

    await fireEvent.click(screen.getByRole("button", { name: "Location" }));
    await choose("Location", "Zagreb Jug");
    await waitFor(() => expect(calls.some((call) => call.url.startsWith("/v1/iam/bindable-roles?level=location&scope_id=8"))).toBe(true));
    await fireEvent.click((await screen.findByRole("option", { name: /Support/ })).querySelector("button") as HTMLElement);
    await fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(body).toEqual({ role_ref: "7", level: "location", scope_id: 8 }));
  });

  it("says why a role was refused, in the dialog", async () => {
    const scopes: ScopeOptions = { root_level: "organization", root: true, places: [] };
    await mount({
      "GET /v1/iam/users/4/access": data(access({ bindings: [], effective: [] })),
      "GET /v1/iam/users/4/scopes": data(scopes),
      "GET /v1/iam/bindable-roles": bindable([seller]),
      "POST /v1/iam/users/4/bindings": refusal(403, "authz.self_assignment"),
    });
    await screen.findByText("No roles");
    await fireEvent.click(within(queryTest("add-role") as HTMLElement).getByRole("button", { name: "Add role" }));
    await findTest("bindable-roles");
    await fireEvent.click(screen.getByRole("option", { name: /Seller/ }).querySelector("button") as HTMLElement);
    await fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("You cannot give a role to yourself.")).toBeTruthy();
  });

  it("tells when there is nowhere to give a role", async () => {
    await mount({ "GET /v1/iam/users/4/access": data(access({ bindings: [], effective: [] })), "GET /v1/iam/users/4/scopes": data({ root_level: "organization", root: false, places: [] }) });
    await screen.findByText("No roles");
    await fireEvent.click(within(queryTest("add-role") as HTMLElement).getByRole("button", { name: "Add role" }));
    await findTest("no-places");
    await settle();
  });
});

describe("the application's adapters", () => {
  it("takes the places, and the root level they name, from the adapter instead of the server", async () => {
    let body: unknown = null;
    const asked: number[] = [];
    running = await startAccess(
      {
        "GET /v1/iam/users/4/access": data(access({ bindings: [], effective: [] })),
        "GET /v1/iam/bindable-roles": data({ roles: [seller] }),
        "POST /v1/iam/users/4/bindings": (call: { init: RequestInit }) => ((body = JSON.parse(String(call.init.body))), data(binding(12, sellerRow))),
      },
      [accessPermissions.viewAccess, accessPermissions.manageBindings],
      "/people/4",
      { scopes: async (subject) => (asked.push(subject.id), { root_level: "company", root: true, places: [] }) }, // /scopes has no answer: asking the server would fail the test
      [personFeature],
    );
    await screen.findByText("No roles");
    await fireEvent.click(within(queryTest("add-role") as HTMLElement).getByRole("button", { name: "Add role" }));
    await findTest("bindable-roles");
    expect(asked).toEqual([4]);
    await fireEvent.click(screen.getByRole("option", { name: /Seller/ }).querySelector("button") as HTMLElement);
    await fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(body).toEqual({ role_ref: "seller", level: "company", scope_id: null }));
  });

  it("makes a holder's name a link where the application says their record is", async () => {
    running = await startAccess(
      {
        "GET /v1/iam/roles/7": data(support),
        "GET /v1/iam/roles/7/holders": data({ holders: [{ subject: { kind: "user", id: 4 }, name: "Ana Anić", scope: root }, { subject: { kind: "service", id: 9 }, name: "Importer", scope: root }] }),
      },
      [accessPermissions.viewRoles],
      "/iam/roles/7",
      { subjectRoute: (subject) => (subject.kind === "user" ? { name: "person" } : null) },
      [personFeature],
    );
    const ana = await screen.findByText("Ana Anić");
    expect(ana.closest("a")?.getAttribute("href")).toBe("/people/4");
    expect(screen.getByText("Importer").closest("a")).toBeNull();
    expect(screen.getByText("Service account")).toBeTruthy();
  });
});

describe("on a phone", () => {
  // jsdom draws no CSS: the stacking is the `compact:` classes on the row, and the reading order is the DOM order.
  const stacked = (row: HTMLElement) => {
    const body = row.querySelector(".row-body > div") as HTMLElement;
    expect(row.dataset.layout).toBe("setting");
    expect(body.className).toContain("compact:flex-col");
    expect(body.querySelector("[data-stacked='compact']")?.className).toContain("compact:flex-col");
    return body;
  };
  const inOrder = (...parts: (HTMLElement | null)[]) =>
    parts.slice(1).forEach((part, i) => expect(parts[i]!.compareDocumentPosition(part as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy());

  it("stacks a role: name and constraints, then the place, then Remove", async () => {
    const media = mockMedia({ compact: true });
    await mount({ "GET /v1/iam/users/4/access": data(access()) });
    const row = (await screen.findByText("Support")).closest("[data-test='form-row']") as HTMLElement;
    const body = stacked(row);
    inOrder(body.querySelector("span.block"), queryTest("binding-scope"), within(row).getByRole("button", { name: "Remove" }));
    media.restore();
  });

  it("stacks an effective permission: name, where it comes from, the reach, then Why", async () => {
    const media = mockMedia({ compact: true });
    await mount({ "GET /v1/iam/users/4/access": data(access()) });
    const row = (await findTest("effective-reach")).closest("[data-test='form-row']") as HTMLElement;
    const body = stacked(row);
    inOrder(body.querySelector("span.block"), queryTest("effective-sources"), queryTest("effective-reach"), within(row).getByRole("button", { name: "Why" }));
    media.restore();
  });
});
