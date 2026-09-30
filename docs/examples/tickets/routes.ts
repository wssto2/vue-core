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
    component: () => import("./views/Record.vue"),
    meta: { access: "tickets:view", titleKey: "tickets.title", remountOnParam: "ticketID" },
  },
});

// ticketRoutes.index                      a route without parameters is a value
// ticketRoutes.record({ ticketID: 12 })   one with parameters is a function; a wrong or missing one does not compile
