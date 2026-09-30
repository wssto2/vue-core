import { defineRoutes } from "@wssto2/vue-core/router";

export const ticketRoutes = defineRoutes({
  index: {
    name: "tickets.index",
    path: "/tickets",
    component: () => import("./views/Index.vue"),
    meta: { access: "tickets:view", titleKey: "tickets.title" },
  },
  record: {
    name: "tickets.record",
    path: "/tickets/:ticketID",
    component: () => import("./views/Details.vue"),
    meta: { access: "tickets:view", titleKey: "tickets.title", remountOnParam: "ticketID" },
  },
});
