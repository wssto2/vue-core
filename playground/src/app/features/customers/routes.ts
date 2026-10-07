import { defineRoutes } from "@wssto2/vue-core/router";

declare module "@wssto2/vue-core/platform" {
  interface PermissionRegistry {
    "customers:view": true;
    "customers:create": true;
  }
}

declare module "@wssto2/vue-core/router" {
  interface DestinationRegistry {
    customers: true;
  }
}

export const customerRoutes = defineRoutes({
  index: {
    name: "customers.index",
    path: "/customers",
    component: () => import("./views/Index.vue"),
    meta: { access: "customers:view", titleKey: "customers.title" },
  },
  // Opens on a starting filter (the user's own location): see `defaults` of `useCollection`.
  local: {
    name: "customers.local",
    path: "/customers/local",
    component: () => import("./views/Local.vue"),
    meta: { access: "customers:view", titleKey: "customers.local_title" },
  },
  // A picker in a dialog: the collection's `pick` mode.
  pick: {
    name: "customers.pick",
    path: "/customers/pick",
    component: () => import("./views/Pick.vue"),
    meta: { access: "customers:view", titleKey: "customers.pick_title" },
  },
  record: {
    name: "customers.record",
    path: "/customers/:customerID",
    component: () => import("./views/Details.vue"),
    meta: { access: "customers:view", titleKey: "customers.title", remountOnParam: "customerID" },
  },
});
