import { defineRoutes } from "@wssto2/vue-core/router";

export const formsRoutes = defineRoutes({
  create: { name: "forms.create", path: "/tickets/new", component: () => import("./views/Create.vue"), meta: { titleKey: "forms.create" } },
  record: { name: "forms.record", path: "/tickets/:ticketID/edit", component: () => import("./views/Record.vue"), meta: { titleKey: "forms.ticket", remountOnParam: "ticketID" } },
});
