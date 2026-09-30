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
  record: {
    name: "customers.record",
    path: "/customers/:customerID",
    component: () => import("./views/Details.vue"),
    meta: { access: "customers:view", titleKey: "customers.title", remountOnParam: "customerID" },
  },
});
