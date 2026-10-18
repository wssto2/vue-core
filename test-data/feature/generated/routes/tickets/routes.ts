import { route } from "@wssto2/vue-core/client";
import type { ShowInput } from "../../../../go-core/tickets/schemas";
import type { TicketResponse } from "./entities";
import type { CreateTicketInput } from "./schemas";

export const ticketsRoutes = {
  list: route<void, TicketResponse[]>("GET", "/tickets"),
  show: route<ShowInput, TicketResponse>("GET", "/tickets/:id", { permission: "tickets.ticket:view" }),
  create: route<CreateTicketInput, TicketResponse>("POST", "/tickets", { permission: "tickets.ticket:manage" }),
} as const;
