import { defineRoutes } from "@wssto2/vue-core/router";

declare module "@wssto2/vue-core/router" {
  interface DestinationRegistry {
    workbench: true;
    pageeditor: true;
  }
}

export const workbenchRoutes = defineRoutes({
  template: { name: "workbench.template", path: "/workbench/template", component: () => import("./views/TemplateEditor.vue"), meta: { titleKey: "workbench.template_title" } },
  page: { name: "workbench.page", path: "/workbench/page", component: () => import("./views/PageEditor.vue"), meta: { titleKey: "workbench.page_title" } },
});
