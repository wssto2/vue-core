import { describe, expect, it } from "vitest";
import type { EffectivePermission, Scope } from "../modules/access/entities";
import { groupEffective } from "./effective";
import { catalogue } from "./testing";

const root: Scope = { level: "organization", id: null, name: null };
const dealer: Scope = { level: "dealer", id: 3, name: "Auto Zagreb" };
const grant = (role: string, qualifier: string, scope = root, binding = 1) => ({ qualifier, scope, attrs: [], binding_id: binding, role_key: role, role_name: role });
const entry = (permission: string, grants: ReturnType<typeof grant>[], unavailable = false): EffectivePermission => ({ permission, grants, unavailable });

describe("groupEffective", () => {
  it("groups by module and screen, the actions in the usual order, the roles that give them once", () => {
    const groups = groupEffective(catalogue, [
      entry("crm.customer:update", [grant("support", "own"), grant("manager", "all", dealer, 2)]),
      entry("crm.customer:view", [grant("support", "own")]),
      entry("crm.lead:view", [grant("support", "all")]),
    ], "organization");
    expect(groups.map((group) => group.key)).toEqual(["crm"]);
    const [customers, leads] = groups[0]?.screens ?? [];
    expect(customers?.key).toBe("crm_customer");
    expect(customers?.actions.map((action) => action.verb)).toEqual(["view", "update"]);
    expect(customers?.sources.map((source) => `${source.roleName}:${source.qualifier}`)).toEqual(["support:own", "manager:all"]);
    expect(customers?.qualifier).toBe("all"); // the widest of the ownable actions
    expect(customers?.scopes).toEqual([root, dealer]); // the root first
    expect(leads?.qualifier).toBeNull(); // nobody owns a lead: no "whose"
  });

  it("marks a screen whose every action is switched off for the tenant", () => {
    const [group] = groupEffective(catalogue, [entry("crm.lead:view", [grant("support", "all")], true)], "organization");
    expect(group?.screens[0]?.allUnavailable).toBe(true);
  });

  it("leaves out a permission with no grant, puts system ones last and shows an unknown one by its module", () => {
    const groups = groupEffective(catalogue, [entry("iam.role:manage", [grant("admin", "all")]), entry("crm.lead:view", []), entry("gone.old:view", [grant("old", "all")])], "organization");
    expect(groups.map((group) => group.key)).toEqual(["gone", "system"]);
    expect(groups[0]?.screens[0]?.key).toBe("gone_old");
  });
});
