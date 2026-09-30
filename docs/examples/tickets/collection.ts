import { defineCollection } from "@wssto2/vue-core/collection";
import type { TicketsApi } from "./api";

// One definition: the list page and the record page's previous / next both read it, so they
// always agree on what "the list" is (its sorts, filters and default state).
export function createTicketList(api: TicketsApi) {
  return defineCollection({
    id: "tickets",
    stateVersion: 1, // bump it when the state's shape changes: stored links and saved views of the old one are dropped
    load: api.list,
    key: (ticket) => ticket.id,
    query: { sorts: ["created_at", "subject"], filters: ["status"] },
    defaults: { sort: "created_at", direction: "desc" },
  });
}
