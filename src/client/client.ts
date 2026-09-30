import { buildQuery, encodeBody, newRequestId, type QueryValue } from "./encode";
import { readResponse, REQUEST_ID_HEADER, type ApiResult } from "./envelope";
import { ApiError, isApiError } from "./error";
import { fetchTransport, type Transport } from "./transport";

export interface RequestOptions {
  query?: Readonly<Record<string, QueryValue>>;
  headers?: HeadersInit;
  /** Cancels the request; it then fails with kind `aborted` (see `isAborted`), it never resolves half-way. */
  signal?: AbortSignal;
  /** False for calls that establish or end the session (sign-in, `/auth/me`), where a 401 is an answer, not an expiry. Default true. */
  handleUnauthorized?: boolean;
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

export interface HttpClient {
  get<TData = unknown, TMeta = unknown>(path: string, options?: RequestOptions): Promise<ApiResult<TData, TMeta>>;
  post<TData = unknown, TMeta = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResult<TData, TMeta>>;
  put<TData = unknown, TMeta = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResult<TData, TMeta>>;
  patch<TData = unknown, TMeta = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResult<TData, TMeta>>;
  delete<TData = unknown, TMeta = unknown>(path: string, options?: RequestOptions): Promise<ApiResult<TData, TMeta>>;
}

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

  async function attempt<TData, TMeta>(
    method: string,
    path: string,
    body: unknown,
    callOptions: RequestOptions,
  ): Promise<ApiResult<TData, TMeta>> {
    const { signal } = callOptions;
    const sentId = options.requestId === false ? null : (options.requestId ?? newRequestId)();
    if (signal?.aborted) throw aborted(sentId, signal.reason);

    const encoded = encodeBody(body);
    const headers = new Headers({ Accept: "application/json" });
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
      return await readResponse<TData, TMeta>(response, sentId);
    } catch (error) {
      if (isApiError(error)) throw error;
      if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw aborted(sentId, error);
      throw new ApiError({
        kind: "network",
        message: error instanceof Error ? error.message : "The server could not be reached",
        requestId: sentId,
        cause: error,
      });
    }
  }

  async function send<TData, TMeta>(
    method: string,
    path: string,
    body: unknown,
    callOptions: RequestOptions = {},
  ): Promise<ApiResult<TData, TMeta>> {
    try {
      return await attempt<TData, TMeta>(method, path, body, callOptions);
    } catch (error) {
      if (!isApiError(error) || error.kind !== "unauthorized" || callOptions.handleUnauthorized === false || !options.onUnauthorized) {
        throw error;
      }
      const decision = await options.onUnauthorized({ error, method, path });
      if (decision !== "retry") throw error;
      return attempt<TData, TMeta>(method, path, body, callOptions);
    }
  }

  return {
    get: (path, callOptions) => send("GET", path, undefined, callOptions),
    post: (path, body, callOptions) => send("POST", path, body, callOptions),
    put: (path, body, callOptions) => send("PUT", path, body, callOptions),
    patch: (path, body, callOptions) => send("PATCH", path, body, callOptions),
    delete: (path, callOptions) => send("DELETE", path, undefined, callOptions),
  };
}
