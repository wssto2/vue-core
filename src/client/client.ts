import { buildQuery, encodeBody, newRequestId, type QueryValue } from "./encode";
import { readResponse, REQUEST_ID_HEADER, type ApiResult } from "./envelope";
import { filenameFromDisposition } from "./disposition";
import { ApiError, isApiError } from "./error";
import type { ApiRoute } from "./route";
import { fetchTransport, type Transport } from "./transport";

export interface RequestOptions {
  query?: Readonly<Record<string, QueryValue>>;
  headers?: HeadersInit;
  /** Cancels the request; it then fails with kind `aborted` (see `isAborted`), it never resolves half-way. */
  signal?: AbortSignal;
  /** False for calls that establish or end the session (sign-in, `/auth/me`), where a 401 is an answer, not an expiry. Default true. */
  handleUnauthorized?: boolean;
}

/**
 * Options of `download` and `stream`: those of the JSON calls plus the `Accept` header (default: any type) and, for
 * `POST`, a body encoded like the body of `post`. A body without `method: "POST"` does not compile.
 */
export type RawRequestOptions = RequestOptions & {
  accept?: string;
} & ({ method?: "GET"; body?: undefined } | { method: "POST"; body?: unknown });

/** A file the server answered: the bytes, the name its `Content-Disposition` proposes (RFC 6266; null when it proposes none) and the exchange's request id. */
export interface DownloadResult {
  blob: Blob;
  filename: string | null;
  requestId: string | null;
}

/** What `onUnauthorized` decides: send the request once more (the session was renewed) or let the 401 fail. */
export type UnauthorizedDecision = "retry" | "fail";

export interface UnauthorizedContext {
  error: ApiError;
  method: string;
  path: string;
}

export interface HttpClientOptions {
  /** Prefixed to paths that are not absolute URLs, e.g. `/api/v1`. */
  baseUrl?: string;
  transport?: Transport;
  /** Headers added to every request (a token); read again on each attempt. Per-call headers win. */
  headers?: () => HeadersInit | Promise<HeadersInit>;
  /** Default `include`, what cookie sessions need. */
  credentials?: RequestCredentials;
  /** The id sent as `X-Request-ID`; false sends none. Default: 32 random hex characters. */
  requestId?: (() => string) | false;
  /**
   * Called when a request is answered 401 (and the call did not opt out). At most once per request:
   * return `"retry"` after renewing the session, else `"fail"`. The client never loops and does not
   * deduplicate concurrent renewals: make the handler share one in-flight promise.
   */
  onUnauthorized?: (context: UnauthorizedContext) => UnauthorizedDecision | Promise<UnauthorizedDecision>;
}

/** A route that takes no input (`void`, or an empty object) needs no second argument. */
type RequestArguments<In> = [In] extends [void]
  ? [input?: undefined, options?: RequestOptions]
  : [In] extends [Record<string, never>]
    ? [input?: In, options?: RequestOptions]
    : [input: In, options?: RequestOptions];

/** A route declared `void` has no body: its data is `null`. */
export type RouteResult<Out, Meta = unknown> = ApiResult<[Out] extends [void] ? null : Out, Meta>;

export interface HttpClient {
  /**
   * Calls a declared route: `:name` segments of the path are filled from `input` (encoded), the rest of
   * `input` is the query for GET and DELETE and the JSON body for POST, PUT and PATCH. A missing path
   * parameter rejects with a plain `Error` (a bug in the caller, not an answer from the server) before
   * anything is sent. Abort, request ids and 401 handling are those of `get` and `post`.
   */
  request<In, Out, Meta>(route: ApiRoute<In, Out, Meta>, ...args: RequestArguments<In>): Promise<RouteResult<Out, Meta>>;
  get<TData = unknown, TMeta = unknown>(path: string, options?: RequestOptions): Promise<ApiResult<TData, TMeta>>;
  post<TData = unknown, TMeta = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResult<TData, TMeta>>;
  put<TData = unknown, TMeta = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResult<TData, TMeta>>;
  patch<TData = unknown, TMeta = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResult<TData, TMeta>>;
  delete<TData = unknown, TMeta = unknown>(path: string, options?: RequestOptions): Promise<ApiResult<TData, TMeta>>;
  /**
   * Fetches a file. Base URL, credentials, `headers()`, `X-Request-ID`, abort and the single 401 renew-and-retry are those of
   * `get`; `Accept` accepts any type unless `options.accept` says otherwise. A non-2xx answer throws the same `ApiError` a JSON call
   * would (its `code`, `fields` and `params` come from the JSON error body), so the caller words a failed download like any failure.
   * The whole body is read before this resolves.
   */
  download(path: string, options?: RawRequestOptions): Promise<DownloadResult>;
  /**
   * Opens a long-lived answer (server-sent events, a streamed file) and resolves with the raw `Response` as soon as its headers
   * are in, body unread: read `response.body`, and pass `options.signal` to end it. Headers, credentials, request id and the 401
   * retry are those of `download`; a non-2xx answer throws an `ApiError`. Once it has resolved, a read that fails or is cancelled
   * rejects with the platform's own error, not an `ApiError`.
   */
  stream(path: string, options?: RawRequestOptions): Promise<Response>;
  /**
   * The `X-Request-ID`s of the last requests this client got an answer to or failed to reach (the server's id, else the one sent),
   * oldest first, at most `RECENT_REQUEST_IDS`: what a bug report quotes so the server's log can be found. A cancelled request leaves none.
   */
  recentRequestIds(): readonly string[];
}

/** How many request ids `recentRequestIds` keeps. */
export const RECENT_REQUEST_IDS = 20;

const isAbsolute = (path: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(path);

function joinUrl(baseUrl: string, path: string, query: string): string {
  const url = isAbsolute(path) || baseUrl === "" ? path : `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
  if (query === "") return url;
  return `${url}${url.includes("?") ? "&" : "?"}${query}`;
}

const aborted = (requestId: string | null, cause?: unknown) =>
  new ApiError({ kind: "aborted", message: "The request was cancelled", requestId, cause });

/** A client over a transport. Nothing is global: every call of this factory is independent. */
export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const { baseUrl = "", transport = fetchTransport, credentials = "include" } = options;
  const recent: string[] = [];
  const remember = (id: string | null) => {
    if (id === null) return;
    recent.push(id);
    if (recent.length > RECENT_REQUEST_IDS) recent.shift();
  };

  type Reader<T> = (response: Response, sentId: string | null) => Promise<T>;

  async function attempt<T>(method: string, path: string, body: unknown, callOptions: RequestOptions, accept: string, read: Reader<T>): Promise<T> {
    const { signal } = callOptions;
    const sentId = options.requestId === false ? null : (options.requestId ?? newRequestId)();
    if (signal?.aborted) throw aborted(sentId, signal.reason);

    const encoded = encodeBody(body);
    const headers = new Headers({ Accept: accept });
    const extra = options.headers ? await options.headers() : undefined;
    for (const source of [extra, callOptions.headers]) {
      if (source) new Headers(source).forEach((value, name) => headers.set(name, value));
    }
    if (sentId !== null && !headers.has(REQUEST_ID_HEADER)) headers.set(REQUEST_ID_HEADER, sentId);
    if (encoded.contentType !== null && !headers.has("Content-Type")) headers.set("Content-Type", encoded.contentType);

    const init: RequestInit = { method, headers, credentials, body: encoded.body, signal };
    const url = joinUrl(baseUrl, path, buildQuery(callOptions.query));

    try {
      const response = await transport(url, init);
      return await read(response, sentId);
    } catch (error) {
      if (isApiError(error)) {
        remember(error.requestId);
        throw error;
      }
      if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw aborted(sentId, error);
      remember(sentId);
      throw new ApiError({
        kind: "network",
        message: error instanceof Error ? error.message : "The server could not be reached",
        requestId: sentId,
        cause: error,
      });
    }
  }

  async function send<T>(method: string, path: string, body: unknown, callOptions: RequestOptions, accept: string, read: Reader<T>): Promise<T> {
    try {
      return await attempt(method, path, body, callOptions, accept, read);
    } catch (error) {
      if (!isApiError(error) || error.kind !== "unauthorized" || callOptions.handleUnauthorized === false || !options.onUnauthorized) {
        throw error;
      }
      const decision = await options.onUnauthorized({ error, method, path });
      if (decision !== "retry") throw error;
      return attempt(method, path, body, callOptions, accept, read);
    }
  }

  const sendJson = <TData, TMeta>(method: string, path: string, body: unknown, callOptions: RequestOptions = {}) =>
    send<ApiResult<TData, TMeta>>(method, path, body, callOptions, "application/json", async (response, sentId) => {
      const result = await readResponse<TData, TMeta>(response, sentId);
      remember(result.requestId);
      return result;
    });

  /** The raw calls: an error answer is read as a JSON call reads it (and throws); a success is handed to `use`. */
  function sendRaw<T>(path: string, options: RawRequestOptions = {}, use: (response: Response, requestId: string | null) => Promise<T>): Promise<T> {
    const { accept = "*/*", method = "GET", body, ...callOptions } = options;
    return send(method, path, body, callOptions, accept, async (response, sentId) => {
      if (!response.ok) await readResponse(response, sentId); // always throws for a non-2xx answer
      const requestId = response.headers.get(REQUEST_ID_HEADER) ?? sentId;
      remember(requestId);
      return use(response, requestId);
    });
  }

  async function request<In, Out, Meta>(route: ApiRoute<In, Out, Meta>, input?: unknown, callOptions: RequestOptions = {}): Promise<RouteResult<Out, Meta>> {
    const values: Record<string, unknown> = typeof input === "object" && input !== null && !Array.isArray(input) ? { ...input } : {};
    const path = route.path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, name: string) => {
      const value = values[name];
      if (value === undefined || value === null || value === "") {
        throw new Error(`${route.method} ${route.path}: the input has no value for the path parameter "${name}"`);
      }
      delete values[name];
      return encodeURIComponent(String(value));
    });
    const hasRest = Object.keys(values).length > 0;
    if (route.method === "GET" || route.method === "DELETE") {
      return sendJson<RouteResult<Out, Meta>["data"], Meta>(route.method, path, undefined, { ...callOptions, query: { ...(values as Record<string, QueryValue>), ...callOptions.query } });
    }
    return sendJson<RouteResult<Out, Meta>["data"], Meta>(route.method, path, hasRest ? values : undefined, callOptions);
  }

  return {
    // the rest-tuple overload is the public contract; the implementation takes its arguments positionally
    request: request as HttpClient["request"],
    get: (path, callOptions) => sendJson("GET", path, undefined, callOptions),
    post: (path, body, callOptions) => sendJson("POST", path, body, callOptions),
    put: (path, body, callOptions) => sendJson("PUT", path, body, callOptions),
    patch: (path, body, callOptions) => sendJson("PATCH", path, body, callOptions),
    delete: (path, callOptions) => sendJson("DELETE", path, undefined, callOptions),
    download: (path, options) =>
      sendRaw(path, options, async (response, requestId) => ({
        blob: await response.blob(),
        filename: filenameFromDisposition(response.headers.get("Content-Disposition")),
        requestId,
      })),
    stream: (path, options) => sendRaw(path, options, async (response) => response),
    recentRequestIds: () => [...recent],
  };
}
