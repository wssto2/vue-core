import { defineRoutes } from "@wssto2/vue-core/router";

declare module "@wssto2/vue-core/router" {
  interface DestinationRegistry {
    pageslist: true;
    templateresources: true;
    characteristics: true;
  }
}

export const listsRoutes = defineRoutes({
  pages: { name: "lists.pages", path: "/lists/pages", component: () => import("./views/PagesList.vue"), meta: { titleKey: "lists.pages_title" } },
  resources: { name: "lists.resources", path: "/lists/resources", component: () => import("./views/TemplateResources.vue"), meta: { titleKey: "lists.resources_title" } },
});
