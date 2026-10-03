import type { HttpClient } from "../../client";
import { defineCollection, readListPage } from "../../collection";
import { eventsRoutes } from "../../modules/events/routes";

/** The dead letters of every consumer of the application's event queue, as go-core's `GET /v1/events/dead-letters` pages them (newest first; only the consumer narrows it). */
export function deadLetterList(http: HttpClient) {
  return defineCollection({
    id: "events.deadletters",
    stateVersion: 1,
    load: async (query, { signal }) => {
      const result = await http.request(eventsRoutes.deadLettersList, { consumer: query.filters.consumer || undefined, page: query.page, per_page: query.pageSize }, { signal });
      return readListPage(result, query);
    },
    key: (row) => `${row.event_id}/${row.consumer}`,
    query: { sorts: [], filters: ["consumer"], views: [], pageSizes: [10, 25, 50, 100], search: false },
    defaults: { pageSize: 25 },
  });
}
