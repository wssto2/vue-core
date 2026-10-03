import type { HttpClient } from "@wssto2/vue-core/client";
import { defineCollection, readListPage } from "@wssto2/vue-core/collection";
import { ticketsRoutes } from "./routes";

export function createTicketList(http: HttpClient) {
  return defineCollection({
    id: "tickets",
    stateVersion: 1,
    // the route's result is a ListResult<Ticket>: readListPage turns it into the page, Row is inferred
    load: async (query, { signal }) => {
      const result = await http.request(
        ticketsRoutes.list,
        { page: query.page, per_page: query.pageSize, search: query.search ?? undefined },
        { signal },
      );
      return readListPage(result, query);
    },
    key: (ticket) => ticket.id,
    query: { sorts: [], filters: [] },
  });
}
