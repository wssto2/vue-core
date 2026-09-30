// The composition root of the playground application: one explicit list of features and a shell.
// `?shell=custom` renders the same application in a shell of its own (CustomShell.vue).
import { appUpdates, backofficeShell } from "@wssto2/vue-core/shell";
import { viewTransitions } from "@wssto2/vue-core/shell";
import { createApplication } from "@wssto2/vue-core/app";
import { createWebHashHistory } from "vue-router";
import "../app.css";
import { appIcons } from "../icons";
import CustomShell from "./CustomShell.vue";
import { shellIcons } from "./icons";
import { createDemoPlatform, type Employee } from "./platform";
import { recordsFeature } from "./features/records/feature";
import { reportsFeature } from "./features/reports/feature";
import { sessionFeature } from "./features/session/feature";
import { themeFeature } from "./features/theme/feature";
import { createTicketsFeature } from "./features/tickets/feature";

const platform = createDemoPlatform();
const custom = new URLSearchParams(location.search).get("shell") === "custom";

const application = createApplication({
  platform,
  router: { history: createWebHashHistory() }, // the page is served from a static file, so the route lives in the hash
  // The default shell: one line, with the application's user typed into `identity`.
  shell: custom
    ? { component: CustomShell, slots: ["headerActions", "accountMenu", "host"] }
    : backofficeShell({ identity: (user: Employee) => ({ name: user.name, detail: user.email }) }),
  icons: { ...appIcons, ...shellIcons },
  i18n: { messages: { en: { nav: { work: "Work", tickets: "Tickets", reports: "Reports", records: "Records" } }, hr: { nav: { work: "Rad", tickets: "Tiketi", reports: "Izvještaji", records: "Zapisi" } } } },
  navigation: { known: ["tickets", "reports", "records"] },
  features: [
    sessionFeature,
    themeFeature,
    createTicketsFeature({ list: () => [{ id: 1, subject: "Printer on fire" }, { id: 2, subject: "No coffee" }] }),
    reportsFeature,
    recordsFeature,
    viewTransitions(), // screen transitions on phones and tablets
    appUpdates({ url: "app.html" }), // offers a reload when a new build is served
  ],
});

void application.mount("#app");
