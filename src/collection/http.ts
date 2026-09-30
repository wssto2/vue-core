import type { ApiResult, HttpClient, QueryValue } from "../client";
import type { CollectionLoader, CollectionPage, CollectionQuery } from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const count = (...candidates: unknown[]): number | null => {
  for (const candidate of candidates) if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
  return null;
};

/**
 * The query parameters go-core's datatable reads: `page`, `per_page`, `order_col`, `order_dir`,
 * `search`, `view`, and every filter under its own key. Empty values are left out (the client drops them).
 */
export function listParams(query: CollectionQuery): Record<string, QueryValue> {
  return {
    // Filters first: the reserved names below always win, a filter called "page" cannot break paging.
    ...query.filters,
    page: query.page,
    per_page: query.pageSize,
    order_col: query.sort,
    order_dir: query.sort ? query.direction : null,
    search: query.search,
    view: query.view,
  };
}

/**
 * Reads a list answer into a `CollectionPage`. Understands go-core's envelope (`data` is the rows,
 * `meta` has `total`, `page`, `per_page`, `last_page`, `from`, `to`, and may carry `views` and lookups)
 * and ARV's older shape with the numbers next to `data` (`current_page`). Missing numbers are derived
 * from what is there rather than becoming 0; `query` supplies the page and size that were asked for.
 */
export function readListPage<Row>(result: ApiResult<unknown, unknown>, query: Pick<CollectionQuery, "page" | "pageSize">): CollectionPage<Row> {
  const body = result.data;
  const legacy = isRecord(body) && Array.isArray(body.data);
  const rows = (Array.isArray(body) ? body : legacy ? body.data : []) as Row[];
  const top = legacy ? body : {};
  const meta = isRecord(result.meta) ? result.meta : isRecord(top.meta) ? top.meta : {};

  const pageSize = count(top.per_page, meta.per_page) ?? query.pageSize;
  const total = count(top.total, meta.total) ?? rows.length;
  const page = count(top.current_page, meta.page, meta.current_page) ?? query.page;
  const lastPage = count(top.last_page, meta.last_page) ?? (total === 0 ? 0 : Math.ceil(total / Math.max(1, pageSize)));
  const from = count(top.from, meta.from) ?? (rows.length === 0 ? 0 : (page - 1) * pageSize + 1);
  const to = count(top.to, meta.to) ?? (rows.length === 0 ? 0 : from + rows.length - 1);

  const views = Array.isArray(meta.views) ? meta.views : Array.isArray(top.views) ? top.views : undefined;
  return {
    rows,
    total,
    page,
    pageSize,
    lastPage,
    from,
    to,
    views: views?.filter(isRecord).flatMap((view) => (typeof view.key === "string" ? [{ key: view.key, count: count(view.count) ?? undefined }] : [])),
    meta,
    requestId: result.requestId,
  };
}

/**
 * The loader of a go-core list endpoint: the common case of a feature's `api.list`.
 *
 *   const api = { list: httpList<Ticket>(http, "/helpdesk/tickets") };
 *
 * `params` adds or renames parameters when the endpoint deviates from the datatable convention.
 */
export function httpList<Row, Sort extends string = string, Filter extends string = string, View extends string = string>(
  http: HttpClient,
  path: string,
  options: { params?: (query: CollectionQuery<Sort, Filter, View>) => Record<string, QueryValue> } = {},
): CollectionLoader<Row, Sort, Filter, View> {
  return async (query, { signal }) => {
    const result = await http.get<unknown>(path, { query: options.params ? options.params(query) : listParams(query), signal });
    return readListPage<Row>(result, query);
  };
}
