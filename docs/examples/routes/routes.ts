import { route } from "@wssto2/vue-core/client";
import type { ListResult } from "@wssto2/vue-core/client";

// What go-core's generator writes from the Go side (types come from the generated schemas and entities).
export interface Ticket {
  readonly id: number;
  readonly subject: string;
  readonly status: "open" | "closed";
}
export interface TicketListInput {
  readonly page?: number;
  readonly per_page?: number;
  readonly search?: string;
}
export interface ShowInput {
  readonly id: number;
}

export const ticketsRoutes = {
  list: route<TicketListInput, ListResult<Ticket>>("GET", "/v1/tickets", { permission: "tickets.ticket:view" }),
  show: route<ShowInput, Ticket>("GET", "/v1/tickets/:id", { permission: "tickets.ticket:view" }),
} as const;
