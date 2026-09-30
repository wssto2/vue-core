// The same application without the reports feature: its route, view and texts are not in this build.
import { createApplication } from "@wssto2/vue-core/app";
import { createWebHashHistory } from "vue-router";
import "../app.css";
import { appIcons } from "../icons";
import { createDemoPlatform } from "./platform";
import Shell from "./Shell.vue";
import { sessionFeature } from "./features/session/feature";
import { createTicketsFeature } from "./features/tickets/feature";

const application = createApplication({
  platform: createDemoPlatform(),
  router: { history: createWebHashHistory() },
  shell: { component: Shell, slots: ["headerActions"] },
  icons: appIcons,
  i18n: { messages: { en: { nav: { work: "Work", tickets: "Tickets", reports: "Reports" } } } },
  features: [sessionFeature, createTicketsFeature({ list: () => [{ id: 1, subject: "Printer on fire" }] })],
});

void application.mount("#app");
