// The composition root of the playground application: one explicit list of features.
import { createApplication } from "@wssto2/vue-core/app";
import { createWebHashHistory } from "vue-router";
import "../app.css";
import { appIcons } from "../icons";
import { createDemoPlatform } from "./platform";
import Shell from "./Shell.vue";
import { reportsFeature } from "./features/reports/feature";
import { sessionFeature } from "./features/session/feature";
import { createTicketsFeature } from "./features/tickets/feature";

const platform = createDemoPlatform();

const application = createApplication({
  platform,
  router: { history: createWebHashHistory() }, // the page is served from a static file, so the route lives in the hash
  shell: { component: Shell, slots: ["headerActions"] },
  icons: appIcons,
  i18n: { messages: { en: { nav: { work: "Work", tickets: "Tickets", reports: "Reports" } }, hr: { nav: { work: "Rad", tickets: "Tiketi", reports: "Izvještaji" } } } },
  navigation: { known: ["tickets", "reports"] },
  features: [
    sessionFeature,
    createTicketsFeature({ list: () => [{ id: 1, subject: "Printer on fire" }, { id: 2, subject: "No coffee" }] }),
    reportsFeature,
  ],
});

void application.mount("#app");
