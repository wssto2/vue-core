// The composition root of the playground application: one explicit list of features.
import { createApplication } from "@wssto2/vue-core/app";
import { createWebHashHistory } from "vue-router";
import "../app.css";
import { appIcons } from "../icons";
import { createDemoPlatform } from "./platform";
import Shell from "./Shell.vue";
import { recordsFeature } from "./features/records/feature";
import { reportsFeature } from "./features/reports/feature";
import { sessionFeature } from "./features/session/feature";
import { createTicketsFeature } from "./features/tickets/feature";

const platform = createDemoPlatform();

const application = createApplication({
  platform,
  router: { history: createWebHashHistory() }, // the page is served from a static file, so the route lives in the hash
  shell: { component: Shell, slots: ["headerActions"] },
  icons: appIcons,
  i18n: { messages: { en: { nav: { work: "Work", tickets: "Tickets", reports: "Reports", records: "Records" } }, hr: { nav: { work: "Rad", tickets: "Tiketi", reports: "Izvještaji", records: "Zapisi" } } } },
  navigation: { known: ["tickets", "reports", "records"] },
  features: [
    sessionFeature,
    createTicketsFeature({ list: () => [{ id: 1, subject: "Printer on fire" }, { id: 2, subject: "No coffee" }] }),
    reportsFeature,
    recordsFeature,
  ],
});

void application.mount("#app");
