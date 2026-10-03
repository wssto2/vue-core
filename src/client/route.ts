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
export interface Route<In, Out> extends RouteBase {
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
export function route<In, Out>(method: HttpMethod, path: string, options: RouteOptions = {}): Route<In, Out> {
  return { method, path, permission: options.permission, public: options.public === true, raw: false };
}

route.raw = (method: HttpMethod, path: string, options: RouteOptions = {}): RawRoute => ({
  method,
  path,
  permission: options.permission,
  public: options.public === true,
  raw: true,
});
