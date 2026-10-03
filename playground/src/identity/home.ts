import { defineFeature } from "@wssto2/vue-core/app";
import { defineRoutes } from "@wssto2/vue-core/router";

const routes = defineRoutes({
  home: { name: "home", path: "/", component: () => import("./Home.vue") },
  // Where the seeded notification "A ticket was assigned to you" points (go-core's dev server).
  ticket: { name: "ticket", path: "/tickets/:id", component: () => import("./Ticket.vue") },
});

export const homeFeature = defineFeature({ id: "home", routes: routes.records });
