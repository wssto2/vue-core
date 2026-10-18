import type { Route } from "@playwright/test";
import type { ListResult } from "../client";
import type { ViewCount } from "../modules/identity/entities";

/** What `route.fulfill` takes: the status, content type and body of one answer. */
export type Answer = NonNullable<Parameters<Route["fulfill"]>[0]>;

/**
 * go-core's success envelope. The library's HTTP client unwraps `data` only from a body that has `success` (the server always
 * sends it), so a fixture for a record the library reads says it too.
 */
export const ok = <T>(data: T, meta?: unknown) => ({ success: true as const, data, ...(meta === undefined ? {} : { meta }) });

/** go-core's paged list: the rows as `data`, the numbers (and any views) in `meta`, as `web.Paginated` writes it. */
export const pageOk = (rows: unknown[], meta: Record<string, unknown> = {}) =>
  ok(rows, { total: rows.length, page: 1, per_page: 20, last_page: 1, from: rows.length === 0 ? 0 : 1, to: rows.length, ...meta });

/** go-core's datatable answer (a `ListResult`): the rows, the paging and `meta.views`, inside the envelope's `data`. */
export const datatable = <Row>(rows: Row[], views?: ViewCount[], paging: Partial<Omit<ListResult<Row>, "data" | "meta">> = {}) =>
  ok<ListResult<Row>>({ data: rows, total: rows.length, per_page: 20, current_page: 1, last_page: 1, from: rows.length ? 1 : 0, to: rows.length, ...(views ? { meta: { views } } : {}), ...paging });

/** A JSON answer for `route.fulfill`. */
export const json = (body: unknown, status = 200): Answer => ({ status, contentType: "application/json", body: JSON.stringify(body) });

/** An empty answer (`204`, a delete or a password change). */
export const noContent = (): Answer => ({ status: 204, body: "" });

/** A server-sent-events answer: each event as one `data:` frame. */
export const sse = (events: unknown[]): Answer => ({ status: 200, contentType: "text/event-stream", body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") });

/** A refusal as go-core sends it: the reason as `code`, its params, and the field it belongs to. */
export const refusal = (status: number, code: string, extra: { params?: unknown; field?: string } = {}): Answer =>
  json({ success: false, error: code, code, ...(extra.params === undefined ? {} : { params: extra.params }), ...(extra.field ? { fields: { [extra.field]: code } } : {}) }, status);
