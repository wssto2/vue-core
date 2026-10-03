import { defineRoutes } from "../router";
import { accessPermissions } from "./context";

/**
 * The pages of the access feature as typed targets (`accessPages.role({ ref })`), for a link from the application's own
 * pages. `/iam/roles/new` is declared before `/iam/roles/:ref`, so "new" is never read as a role's ref.
 */
export const accessPages = defineRoutes({
  roles: { name: "access.roles", path: "/iam/roles", component: () => import("./RolesPage.vue"), meta: { access: accessPermissions.viewRoles, titleKey: "core.access.title" } },
  newRole: { name: "access.roles.new", path: "/iam/roles/new", component: () => import("./NewRolePage.vue"), meta: { access: accessPermissions.manageRoles, titleKey: "core.access.new_title" } },
  role: {
    name: "access.role",
    path: "/iam/roles/:ref",
    component: () => import("./RolePage.vue"),
    // A role's ref (its key, or the id of a custom one) swaps in place when a link leads to another role.
    meta: { access: accessPermissions.viewRoles, titleKey: "core.access.title", remountOnParam: "ref" },
  },
});
