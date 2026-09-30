import { defineFeature, provideContext } from "@wssto2/vue-core/app";
import type { HttpClient } from "@wssto2/vue-core/client";
import { localeMessages } from "@wssto2/vue-core/i18n";
import { createTicketsApi } from "./api";
import { createTicketList } from "./collection";
import { TICKETS } from "./context";
import { ticketRoutes } from "./routes";

// A feature is one value: what the application installs for it. Its collaborators are ordinary
// arguments, visible in the composition root.
export function createTicketsFeature(http: HttpClient) {
  const api = createTicketsApi(http);
  return defineFeature({
    id: "tickets",
    routes: ticketRoutes.records,
    context: provideContext(TICKETS, { api, list: createTicketList(api) }),
    // Loaded the first time a route of this feature is entered, in the active locale.
    messages: localeMessages("tickets", { en: () => import("./i18n/en.json"), hr: () => import("./i18n/hr.json") }),
    // The backend's menu names destinations; this says which route opens "tickets" and which records keep it highlighted.
    navigation: [{ destination: "tickets", to: ticketRoutes.index, within: ["tickets.record"] }],
  });
}
