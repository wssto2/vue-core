import type { HttpClient } from "@wssto2/vue-core/client";
import type { SelectOption, TextSuggestion } from "@wssto2/vue-core/form";

/** What the server sends. The form never edits this: it edits a draft (see form.ts) that is mapped to and from it. */
export interface Ticket {
  readonly id: number;
  readonly subject: string;
  readonly priority: number | null;
  readonly due_on: string | null;
  readonly email: string;
  readonly phone: string;
  /** Bumped by every save: a save that carries an older one is stale (409). */
  readonly version: number;
}

/** The body of the record's full update: every field, and the version it was read at. */
export interface TicketBody {
  subject: string;
  priority: number | null;
  due_on: string | null;
  email: string;
  phone: string;
  version: number;
}

export interface ContactBody {
  email: string;
  phone: string;
}

export function createTicketFormsApi(http: HttpClient) {
  const idempotency = (key: string) => ({ headers: { "Idempotency-Key": key } });
  return {
    get: (id: number, signal: AbortSignal) => http.get<Ticket>(`/tickets/${id}`, { signal }).then((result) => result.data),
    /** The record's full update. */
    update: (id: number, body: TicketBody, key: string) => http.put<Ticket>(`/tickets/${id}`, body, idempotency(key)).then((result) => result.data),
    /** A dedicated endpoint for the contact group: only those fields, nothing returned. */
    saveContact: (id: number, body: ContactBody) => http.put<null>(`/tickets/${id}/contact`, body).then(() => undefined),
    create: (body: Omit<TicketBody, "version">, key: string) => http.post<{ id: number }>("/tickets", body, idempotency(key)).then((result) => result.data),
    assign: (id: number, body: { assignee_id: number; note: string }, key: string) => http.post<Ticket>(`/tickets/${id}/assign`, body, idempotency(key)).then((result) => result.data),
    cities: (query: string, signal: AbortSignal) =>
      http.get<{ name: string; country: string }[]>("/cities", { query: { search: query }, signal }).then((result) => result.data.map((city): TextSuggestion => ({ text: city.name, detail: city.country }))),
    users: (query: string, signal: AbortSignal) =>
      http.get<{ id: number; name: string }[]>("/users", { query: { search: query }, signal }).then((result) => result.data.map((user): SelectOption<number> => ({ value: user.id, label: user.name }))),
  };
}

export type TicketFormsApi = ReturnType<typeof createTicketFormsApi>;
