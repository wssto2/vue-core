import type { HttpClient } from "@wssto2/vue-core/client";
import { defineCollection, httpList } from "@wssto2/vue-core/collection";
import { ticketsRoutes } from "@/generated/routes/tickets/routes";
import type { TicketForm } from "./form";
import type { Ticket } from "./types";

export type TicketSort = "name" | "created_at" | "updated_at";

// The requests are the route table go-core generates from the Go feature's Contract (ts:generate-routes): the ids
// are the URL's, the rest of the input is the body.
export const ticketsApi = (http: HttpClient) => ({
  list: httpList<Ticket, TicketSort, never>(http, ticketsRoutes.list.path),

  async get(id: number): Promise<Ticket> {
    return (await http.request(ticketsRoutes.show, { id })).data;
  },

  /** A 422 lands on the form's fields (`form.submit`). */
  async create(payload: TicketForm, idempotencyKey: string): Promise<Ticket> {
    return (await http.request(ticketsRoutes.create, payload, { headers: { "Idempotency-Key": idempotencyKey } })).data;
  },
});

export type TicketApi = ReturnType<typeof ticketsApi>;

/** The list: the list page and a record's previous / next both read this one definition. */
export const ticketList = (api: TicketApi) =>
  defineCollection({
    id: "helpdesk.tickets",
    stateVersion: 1,
    load: api.list,
    key: (item: Ticket) => item.id ?? 0, // generated entities type `id` as nullable
    query: { sorts: ["name", "created_at", "updated_at"], filters: [] },
    defaults: { sort: "created_at", direction: "asc" },
  });
