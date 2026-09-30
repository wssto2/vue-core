/**
 * Why a request failed, as a closed set the caller can `switch` on:
 *
 * - `validation`: the server refused the input (422, or 400 with field errors); `fields` says where.
 * - `unauthorized` (401), `forbidden` (403), `notFound` (404), `conflict` (409).
 * - `rejected`: any other 4xx (400 without fields, 429, ...).
 * - `server`: 5xx.
 * - `network`: no answer at all (offline, DNS, CORS, reset); `status` is null.
 * - `aborted`: the caller cancelled through its `AbortSignal`. Not a failure: ignore it (see `isAborted`).
 * - `malformed`: a success status whose body could not be read as JSON (a proxy page, a truncated answer).
 */
export type ApiErrorKind =
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "notFound"
  | "conflict"
  | "rejected"
  | "server"
  | "network"
  | "aborted"
  | "malformed";

/** Messages per field name, as go-core's validation answer sends them. */
export type FieldErrors = Readonly<Record<string, readonly string[]>>;

export interface ApiErrorInit {
  kind: ApiErrorKind;
  message: string;
  status?: number | null;
  fields?: FieldErrors;
  /** go-core's stable `reason` (the answer's `code`), e.g. `iam.role_in_use`; translate it, do not parse the message. */
  code?: string | null;
  /** Interpolation params for translating `code`. */
  params?: Readonly<Record<string, unknown>> | null;
  requestId?: string | null;
  /** The decoded error body, when there was one. */
  payload?: unknown;
  cause?: unknown;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** The HTTP status; null when there was no answer (`network`, `aborted`). */
  readonly status: number | null;
  /** Field messages; empty unless the answer carried them (always set for `validation`). */
  readonly fields: FieldErrors;
  readonly code: string | null;
  readonly params: Readonly<Record<string, unknown>> | null;
  /** The `X-Request-ID` of the exchange: the server's, else the one this client sent. Quote it in a bug report. */
  readonly requestId: string | null;
  readonly payload: unknown;
  /** The underlying failure (the transport's exception), when there was one. */
  readonly cause: unknown;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = "ApiError";
    this.kind = init.kind;
    this.status = init.status ?? null;
    this.fields = init.fields ?? {};
    this.code = init.code ?? null;
    this.params = init.params ?? null;
    this.requestId = init.requestId ?? null;
    this.payload = init.payload ?? null;
    this.cause = init.cause;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/** A cancelled request is not a failure: `catch (e) { if (isAborted(e)) return; throw e; }`. */
export function isAborted(value: unknown): value is ApiError & { readonly kind: "aborted" } {
  return value instanceof ApiError && value.kind === "aborted";
}

/** The kind of an HTTP error answer. `hasFields` is whether the body carried field messages. */
export function kindForStatus(status: number, hasFields: boolean): ApiErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 409) return "conflict";
  if (status === 422 || (status === 400 && hasFields)) return "validation";
  if (status >= 500) return "server";
  return "rejected";
}
