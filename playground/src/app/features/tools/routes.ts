import { defineRoutes } from "@wssto2/vue-core/router";

declare module "@wssto2/vue-core/router" {
  interface DestinationRegistry {
    tools: true;
  }
}

export const toolRoutes = defineRoutes({
  index: { name: "tools.index", path: "/tools", component: () => import("./views/Index.vue"), meta: { titleKey: "tools.title" } },
});
