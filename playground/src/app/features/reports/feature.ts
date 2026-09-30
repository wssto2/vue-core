import { defineFeature } from "@wssto2/vue-core/app";
import { localeMessages } from "@wssto2/vue-core/i18n";
import { defineRoutes } from "@wssto2/vue-core/router";

const reportRoutes = defineRoutes({
  index: {
    name: "reports.index",
    path: "/reports",
    component: () => import("./views/Overview.vue"),
    meta: { access: "reports:view", titleKey: "reports.title" },
  },
});

// Remove this feature from the list in main.ts and its view, its texts and its route leave the build.
export const reportsFeature = defineFeature({
  id: "reports",
  routes: reportRoutes.records,
  messages: localeMessages("reports", { en: () => import("./i18n/en.json"), hr: () => import("./i18n/hr.json") }),
  navigation: [{ destination: "reports", to: reportRoutes.index }],
});
