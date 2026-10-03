// The permissions of go-core's dev server, in the shape `authzts` writes (`frontend/generated/permissions.ts` of an application):
// crm.customer:view and iam.user:impersonate are the dev server's own, the rest are the access and identity modules'.
import type { PermissionCatalogue } from "@wssto2/vue-core/access";

const meta = (module: string, resource: string, verb: string, extra: Partial<PermissionCatalogue[string]> = {}): PermissionCatalogue[string] => ({
  module, resource, verb, labelKey: `perm.${module}.${resource}.${verb}`, descriptionKey: "", sensitive: false, system: false, organizationOnly: false, ownable: null, unownedIsOwn: false, feature: null, attributes: [], requires: [], ...extra,
});

export const permissions: PermissionCatalogue = {
  "crm.customer:view": meta("crm", "customer", "view", { ownable: "crm.customer" }),
  "iam.role:view": meta("iam", "role", "view"),
  "iam.role:manage": meta("iam", "role", "manage", { sensitive: true, requires: ["iam.role:view"] }),
  "iam.role:delete": meta("iam", "role", "delete", { sensitive: true, requires: ["iam.role:view"] }),
  "iam.user:view": meta("iam", "user", "view"),
  "iam.user:manage": meta("iam", "user", "manage", { sensitive: true, requires: ["iam.user:view"] }),
  "iam.user:impersonate": meta("iam", "user", "impersonate", { sensitive: true }),
};

// The application's texts for the catalogue, in the shapes the screens look for (`access.modules`, `access.resources`, `access.ownable`, the permission labels).
export const permissionMessages = {
  en: {
    perm: { crm: { customer: { view: "View customers" } }, iam: { role: { view: "View roles", manage: "Create and edit roles", delete: "Delete roles" }, user: { view: "View people and their access", manage: "Give and remove roles", impersonate: "Sign in as another person" } } },
    access: { modules: { crm: "Customers", iam: "Administration" }, resources: { crm_customer: "Customers", iam_role: "Roles", iam_user: "People" }, ownable: { crm_customer: "Whose customers" } },
  },
};
