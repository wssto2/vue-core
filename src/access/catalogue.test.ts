import { describe, expect, it } from "vitest";
import { completeRequired, dependantsClosure, grant, ownableQualifier, permissionTree, requiredClosure, revoke, setOwnableQualifier, type Grants, type PermissionCatalogue, type PermissionMeta } from "./catalogue";

const meta = (id: string, extra: Partial<PermissionMeta> = {}): [string, PermissionMeta] => {
  const [namespace = "", verb = ""] = id.split(":");
  const [module = "", ...rest] = namespace.split(".");
  return [id, { module, resource: rest.join("."), verb, labelKey: "", descriptionKey: "", sensitive: false, system: false, organizationOnly: false, ownable: null, unownedIsOwn: false, feature: null, attributes: [], requires: [], ...extra }];
};

// Two modules, an ownable record type, a requirement chain (delete needs update needs view) and a system permission.
const catalogue: PermissionCatalogue = Object.fromEntries([
  meta("crm.customer:view", { ownable: "crm.customer" }),
  meta("crm.customer:update", { ownable: "crm.customer", requires: ["crm.customer:view"] }),
  meta("crm.customer:delete", { ownable: "crm.customer", requires: ["crm.customer:update"] }),
  meta("crm.lead:view"),
  meta("billing:view"),
  meta("iam.role:manage", { system: true }),
]);

describe("permissionTree", () => {
  it("groups by module with the system permissions last, screens by name, verbs in the usual order", () => {
    const tree = permissionTree(catalogue);
    expect(tree.map((group) => group.key)).toEqual(["billing", "crm", "system"]);
    expect(tree[1]?.screens.map((screen) => screen.key)).toEqual(["crm_customer", "crm_lead"]);
    expect(tree[1]?.screens[0]?.permissions.map((entry) => entry.verb)).toEqual(["view", "update", "delete"]);
    expect(tree[0]?.screens[0]?.key).toBe("billing");
  });
});

describe("requirements", () => {
  it("walks what a permission needs and what needs it, transitively", () => {
    expect(requiredClosure(catalogue, "crm.customer:delete").sort()).toEqual(["crm.customer:update", "crm.customer:view"]);
    expect(dependantsClosure(catalogue, "crm.customer:view").sort()).toEqual(["crm.customer:delete", "crm.customer:update"]);
  });

  it("switching a permission on switches on what it needs, off takes what needs it", () => {
    const grants: Grants = {};
    grant(catalogue, grants, "crm.customer:delete");
    expect(Object.keys(grants).sort()).toEqual(["crm.customer:delete", "crm.customer:update", "crm.customer:view"]);
    revoke(catalogue, grants, "crm.customer:update");
    expect(Object.keys(grants)).toEqual(["crm.customer:view"]);
  });

  it("completes a role that lacks what its permissions need, and says what it added", () => {
    const grants: Grants = { "crm.customer:update": "all" };
    expect(completeRequired(catalogue, grants)).toEqual(["crm.customer:view"]);
    expect(completeRequired(catalogue, grants)).toEqual([]);
  });
});

describe("whose", () => {
  it("is held once per record type: a new grant takes what the role already holds, else own", () => {
    const grants: Grants = {};
    grant(catalogue, grants, "crm.customer:view");
    expect(grants).toEqual({ "crm.customer:view": "own" });
    setOwnableQualifier(catalogue, grants, "crm.customer", "all");
    grant(catalogue, grants, "crm.customer:update");
    expect(grants["crm.customer:update"]).toBe("all");
    expect(ownableQualifier(catalogue, grants, "crm.customer")).toBe("all");
  });

  it("is `all` for a permission nobody owns, and null for a record type the role holds nothing of", () => {
    const grants: Grants = {};
    grant(catalogue, grants, "crm.lead:view");
    expect(grants["crm.lead:view"]).toBe("all");
    expect(ownableQualifier(catalogue, {}, "crm.customer")).toBeNull();
  });

  it("leaves a permission the catalogue does not know alone", () => {
    const grants: Grants = { "gone.old:view": "all" };
    completeRequired(catalogue, grants);
    grant(catalogue, grants, "gone.old:view");
    expect(grants).toEqual({ "gone.old:view": "all" });
  });
});
