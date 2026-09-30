import { defineFeatureContext } from "@wssto2/vue-core/platform";

export interface Ticket {
  readonly id: number;
  readonly subject: string;
}

/** What the tickets views need from their application: an API they can be tested with a fake of. */
export interface TicketsDependencies {
  readonly list: () => readonly Ticket[];
}

export const [TICKETS, useTickets] = defineFeatureContext<TicketsDependencies>("playground.tickets");
