import type { HttpClient } from "@wssto2/vue-core/client";
import { httpList } from "@wssto2/vue-core/collection";

export interface Ticket {
  readonly id: number;
  readonly subject: string;
  readonly status: "open" | "closed";
  readonly assignee: string | null;
  readonly created_at: string;
}

/** The tickets endpoints over the application's client: views never build requests. */
export function createTicketsApi(http: HttpClient) {
  return {
    list: httpList<Ticket>(http, "/tickets"),
    get: (id: number, signal: AbortSignal) => http.get<Ticket>(`/tickets/${id}`, { signal }).then((result) => result.data),
  };
}

export type TicketsApi = ReturnType<typeof createTicketsApi>;
