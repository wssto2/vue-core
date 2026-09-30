import { defineFeature, provideContext } from "@wssto2/vue-core/app";
import { localeMessages } from "@wssto2/vue-core/i18n";
import { TICKETS, type TicketsDependencies } from "./context";
import { ticketRoutes } from "./routes";

// A feature factory: the collaborators are ordinary arguments, visible in the composition root.
export function createTicketsFeature(dependencies: TicketsDependencies) {
  return defineFeature({
    id: "tickets",
    routes: ticketRoutes.records,
    context: provideContext(TICKETS, dependencies),
    messages: localeMessages("tickets", { en: () => import("./i18n/en.json"), hr: () => import("./i18n/hr.json") }),
    // The backend's "tickets" destination opens the list; a record page keeps it highlighted.
    navigation: [{ destination: "tickets", to: ticketRoutes.index, within: ["tickets.record"] }],
    backend: ["tickets"],
  });
}
