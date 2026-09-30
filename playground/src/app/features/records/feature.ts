import { defineFeature } from "@wssto2/vue-core/app";
import { localeMessages } from "@wssto2/vue-core/i18n";
import { recordRoutes } from "./routes";

// Dealer-like, customer-like and lead-like record pages on the application runtime, over a fake API.
export const recordsFeature = defineFeature({
  id: "records",
  routes: recordRoutes.records,
  messages: localeMessages("records", { en: () => import("./i18n/en.json"), hr: () => import("./i18n/hr.json") }),
  // The backend's "records" destination opens the list; every record page keeps it highlighted.
  navigation: [{ destination: "records", to: recordRoutes.index, within: ["records.dealer", "records.customer", "records.lead"] }],
});
