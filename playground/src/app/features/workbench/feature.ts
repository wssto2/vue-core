import { defineFeature } from "@wssto2/vue-core/app";
import { localeMessages } from "@wssto2/vue-core/i18n";
import { workbenchRoutes } from "./routes";

// The workbench pieces on two screens: a template editor (code beside its preview) and a page editor (a preview with a docked sheet).
export const workbenchFeature = defineFeature({
  id: "workbench",
  routes: workbenchRoutes.records,
  messages: localeMessages("workbench", { en: () => import("./i18n/en.json"), hr: () => import("./i18n/hr.json") }, { essential: true }),
  navigation: [
    { destination: "workbench", to: workbenchRoutes.template },
    { destination: "pageeditor", to: workbenchRoutes.page },
  ],
});
