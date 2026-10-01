import { defineFeature } from "@wssto2/vue-core/app";
import { localeMessages } from "@wssto2/vue-core/i18n";
import { workflowRoutes } from "./routes";

// The step-by-step forms (a lead in a modal, an appraisal entry whose steps depend on answers), a record whose sections are workflow steps,
// and the photo viewer, over in-memory data.
export const workflowsFeature = defineFeature({
  id: "workflows",
  routes: workflowRoutes.records,
  messages: localeMessages("workflows", { en: () => import("./i18n/en.json"), hr: () => import("./i18n/hr.json") }, { essential: true }),
  navigation: [{ destination: "workflows", to: workflowRoutes.index, within: ["workflows.appraisal", "workflows.photos"] }],
});
