import { defineFeatureContext } from "@wssto2/vue-core/platform";
import type { TicketsApi } from "./api";
import type { createTicketList } from "./collection";

export interface TicketsDependencies {
  readonly api: TicketsApi;
  readonly list: ReturnType<typeof createTicketList>;
}

// A typed key: `useTickets()` fails with a clear message when the feature is not installed.
export const [TICKETS, useTickets] = defineFeatureContext<TicketsDependencies>("tickets");
