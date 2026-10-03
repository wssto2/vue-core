import { personRolesSection } from "@wssto2/vue-core/access";
import { defineRoutes } from "@wssto2/vue-core/router";

// The person's record lists "Roles" among its sections; `personRolesSection` is the label, the icon and the permission go-core guards the access with.
export const userRoutes = defineRoutes({
  record: {
    name: "users.record",
    path: "/users/:id",
    component: () => import("./PersonRoles.vue"),
    meta: { remountOnParam: "id" },
    children: [{ name: "users.record.roles", path: "roles", component: () => import("./PersonRoles.vue"), meta: personRolesSection }],
  },
});
