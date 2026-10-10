import { defineFeature } from "@wssto2/vue-core/app";
import { localeMessages } from "@wssto2/vue-core/i18n";
import { formsRoutes } from "./routes";

// Forms on the application runtime: a customer-like record edited in group sheets (D22), a long create form (offer-like: sections, a summary
// aside, derived totals) and a command dialog, over an in-memory fake backend that answers 422 and 409.
export const formsFeature = defineFeature({
  id: "forms",
  routes: formsRoutes.records,
  // Essential: the sidebar shows this feature's name before any of its routes is entered.
  messages: localeMessages("forms", { en: () => import("./i18n/en.json"), hr: () => import("./i18n/hr.json") }, { essential: true }),
  navigation: [{ destination: "forms", to: formsRoutes.index, within: ["forms.account", "forms.offer.new", "forms.dates", "forms.options", "forms.pickers", "forms.steps"] }],
});
