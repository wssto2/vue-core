declare const types: unique symbol;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RouteOptions {
  /** The permission the route needs (`"tickets.ticket:view"`); the server enforces it, the client can read it for links and menus. */
  readonly permission?: string;
  /** True for routes that need no session. */
  readonly public?: boolean;
}

interface RouteBase {
  readonly method: HttpMethod;
  /** Versioned and relative to the client's `baseUrl`; `:name` segments are filled from the input. */
  readonly path: string;
  readonly permission?: string;
  readonly public: boolean;
}

/** A typed call: `In` is what `client.request` takes, `Out` what it resolves to (`void`: no body). */
export interface ApiRoute<In, Out> extends RouteBase {
  readonly raw: false;
  /** Type-only; never set. */
  readonly [types]?: { readonly in: In; readonly out: Out };
}

/** A route without a JSON answer (an event stream, a file): it keeps method and path for links, `client.request` refuses it. */
export interface RawRoute extends RouteBase {
  readonly raw: true;
}

/**
 * Declares one endpoint. go-core's generator writes these; the types come from the Go input and response.
 *
 *   route<ShowInput, Ticket>("GET", "/v1/tickets/:id", { permission: "tickets.ticket:view" })
 */
export function route<In, Out>(method: HttpMethod, path: string, options: RouteOptions = {}): ApiRoute<In, Out> {
  return { method, path, permission: options.permission, public: options.public === true, raw: false };
}

route.raw = (method: HttpMethod, path: string, options: RouteOptions = {}): RawRoute => ({
  method,
  path,
  permission: options.permission,
  public: options.public === true,
  raw: true,
});

/** One tab's count in `meta.views` (go-core `datatable.ViewCount`). */
export interface ViewCount {
  readonly key: string;
  readonly count: number;
}

/**
 * The wire shape of go-core's `datatable.DatatableResult[T]`: a page of rows with its numbers.
 * `readListPage` (`/collection`) reads it into a `ListPage` with no glue.
 */
export interface ListResult<Row> {
  readonly data: readonly Row[];
  readonly meta?: Readonly<Record<string, unknown>> & { readonly views?: readonly ViewCount[] };
  readonly total: number;
  readonly per_page: number;
  readonly current_page: number;
  readonly last_page: number;
  readonly from: number;
  readonly to: number;
}
