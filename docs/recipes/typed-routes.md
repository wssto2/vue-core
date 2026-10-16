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

## Calling a route

`request(route, input, options?)` fills the `:params` of the path from `input` (encoded), sends the rest of `input` as the query for GET and DELETE and as the JSON body for POST, PUT and PATCH, and resolves to the same `ApiResult` as `get` and `post`. A route without input (`void`) needs no second argument, and a route without a body (`void`) resolves to `data: null`. `options` are those of `get` and `post`: `signal`, `headers`, `query` (added to the input's), `handleUnauthorized`. Abort, request ids and 401 handling are the client's, unchanged.

<!-- example: docs/examples/routes/api.ts -->
```ts
import { createHttpClient, isApiError } from "@wssto2/vue-core/client";
import { ticketsRoutes } from "./routes";
import { route } from "@wssto2/vue-core/client";

const http = createHttpClient({ baseUrl: "/api" });

// A path parameter and the rest as the query: GET /api/v1/tickets/7
export async function loadTicket(id: number, signal: AbortSignal) {
  const result = await http.request(ticketsRoutes.show, { id }, { signal });
  return result.data; // typed as Ticket
}

const create = route<{ subject: string }, { id: number }>("POST", "/v1/tickets");
const close = route<{ id: number; reason: string }, void>("POST", "/v1/tickets/:id/close");
const health = route<void, string>("GET", "/v1/health");

export async function work() {
  // POST: the input is the JSON body
  const created = await http.request(create, { subject: "Printer" });
  // path parameter out of the input, the rest in the body; a route without a body resolves to data null
  await http.request(close, { id: created.data.id, reason: "done" });
  // no input: no second argument
  return (await http.request(health)).data;
}

export async function safely() {
  try {
    await http.request(ticketsRoutes.show, { id: 0 });
  } catch (error) {
    // the server's answers are ApiErrors; a missing path parameter is a plain Error (a bug, thrown before sending)
    if (isApiError(error)) return error.kind;
    throw error;
  }
}
```

- **Misuse does not compile.** A wrong or missing input field, a wrong use of the response, and `request` on a `route.raw` (an event stream or a file: it keeps `method` and `path` for a link) are `vue-tsc` errors.
- **Path parameters are checked by go-core**, not by TypeScript: it refuses at start-up and in `contract.Generate` a path whose `:param` has no matching `path:"..."` input field, and the reverse. The client still throws a plain `Error` naming the route and the parameter, before sending anything, if a value is missing at runtime (a `null` from an unchecked source). It is a plain `Error` because it is a bug in the caller, not an answer from the server: `isApiError` stays about the wire.
- **The base URL.** Paths carry the version (`/v1/...`); the application's prefix (`/api`) is the client's `baseUrl`.

## Downloads and streams

`get` and `request` read JSON. A file or an event stream goes through `download` and `stream`, which share everything else with them: base URL, credentials, the `headers` hook, `X-Request-ID` (and `recentRequestIds`), abort through `signal`, and the single 401 renew-and-retry of `onUnauthorized`.

<!-- example: docs/examples/routes/files.ts -->
```ts
import { createHttpClient, isApiError, saveBlob } from "@wssto2/vue-core/client";

const http = createHttpClient({ baseUrl: "/api" });

// A file: the bytes, the name the server proposes (null when it proposes none) and the request id.
export async function saveReport(id: number, signal: AbortSignal) {
  try {
    const { blob, filename } = await http.download(`/v1/reports/${id}/pdf`, { signal, accept: "application/pdf" });
    saveBlob(blob, filename ?? `report-${id}.pdf`);
  } catch (error) {
    // the same ApiError as a JSON call: kind, code, params, requestId from the server's error body
    if (isApiError(error)) return error.code;
    throw error;
  }
}

// A POST with a body, encoded like `post`.
export const exportRows = (ids: number[]) => http.download("/v1/rows/export", { method: "POST", body: { ids } });

// A stream: the raw Response once the headers are in; the signal ends it.
export async function follow(onEvent: (chunk: string) => void, signal: AbortSignal) {
  const response = await http.stream("/v1/events", { accept: "text/event-stream", signal });
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  for (let part = await reader.read(); !part.done; part = await reader.read()) onEvent(part.value);
}
```

- **`download(path, { method?, body?, accept?, query?, headers?, signal?, handleUnauthorized? })`** resolves to `{ blob, filename, requestId }` once the whole body is in. `method` is `GET` (default) or `POST`; `accept` defaults to any type. `filename` is read from `Content-Disposition` (RFC 6266): `filename*=UTF-8''…` wins over `filename=`, quotes are handled, a directory part is dropped, and it is `null` when the header proposes no name. Fall back to a name of your own, as above. `saveBlob(blob, filename)` hands the file to the browser's downloads; `openBlob(blob)` shows a PDF in a new tab instead.
- **A failed download is an `ApiError`**, built from the JSON error body exactly as for `get`: `kind` from the status, and the server's `code`, `params` and `fields`. Word it with `describeError` like any other failure. An error answer that is not JSON gives the status message and `code: null`.
- **`stream(path, options)`** takes the same options and resolves to the raw `Response` as soon as its headers are in, so the body is yours to read; end it with the `signal`. Only the opening can throw an `ApiError` (non-2xx, 401 after the retry, network). A read that fails later, or is cancelled, rejects with the platform's own error.
- Neither call reads the `{ success, data }` envelope; a success answer is the bytes.
