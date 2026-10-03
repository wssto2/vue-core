# Recipe: typed routes

go-core's generator writes one `route` per endpoint, with the Go input and response as its types. `client.request(route, input)` calls it: the compiler checks the input and types the answer, so a view never builds a URL.

## A list from a route

A list endpoint answers with a `ListResult<Row>` (go-core's datatable result). `readListPage` reads it into the page a collection loads, with no glue and `Row` inferred.

<!-- example: docs/examples/routes/routes.ts -->
```ts
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
```

<!-- example: docs/examples/routes/collection.ts -->
```ts
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
```
