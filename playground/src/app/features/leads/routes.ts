import { defineRoutes } from "@wssto2/vue-core/router";

declare module "@wssto2/vue-core/platform" {
  interface PermissionRegistry {
    "leads:view": true;
  }
}

declare module "@wssto2/vue-core/router" {
  interface DestinationRegistry {
    leads: true;
  }
}

export const leadRoutes = defineRoutes({
  index: {
    name: "leads.index",
    path: "/leads",
    component: () => import("./views/Index.vue"),
    meta: { access: "leads:view", titleKey: "leads.title" },
  },
  record: {
    name: "leads.record",
    path: "/leads/:leadID",
    component: () => import("./views/Details.vue"),
    meta: { access: "leads:view", titleKey: "leads.title", remountOnParam: "leadID" },
  },
});
