import { defineFeature } from "@wssto2/vue-core/app";
import { localeMessages } from "@wssto2/vue-core/i18n";
import { toolRoutes } from "./routes";

// The small tools of V10b on one page: the access gate, describeError, useLoad, the shortcut registry, the framed-app hooks, category hues.
export const toolsFeature = defineFeature({
  id: "tools",
  routes: toolRoutes.records,
  messages: localeMessages("tools", { en: () => import("./i18n/en.json"), hr: () => import("./i18n/hr.json") }, { essential: true }),
  navigation: [{ destination: "tools", to: toolRoutes.index }],
});
