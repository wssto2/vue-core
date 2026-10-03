import { defineFeature } from "@wssto2/vue-core/app";
import { defineRoutes } from "@wssto2/vue-core/router";

const routes = defineRoutes({
  home: { name: "home", path: "/", component: () => import("./Home.vue") },
});

export const homeFeature = defineFeature({ id: "home", routes: routes.records });
