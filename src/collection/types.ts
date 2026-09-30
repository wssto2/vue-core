export type SortDirection = "asc" | "desc";

/**
 * What a list asks the backend for: the whole state of a collection, which is also what the URL
 * stores. `Sort`, `Filter` and `View` are the keys the definition's query contract allows.
 */
export interface CollectionQuery<Sort extends string = string, Filter extends string = string, View extends string = string> {
  /** 1-based. */
  readonly page: number;
  readonly pageSize: number;
  /** The backend's sort key; null when the list keeps the backend's own order. */
  readonly sort: Sort | null;
  readonly direction: SortDirection;
  readonly search: string;
  /** The selected scope (a tab over the list); null when the list has none. */
  readonly view: View | null;
  /** Filter values are what the URL and the backend carry: text. Empty filters are absent. */
  readonly filters: Readonly<Partial<Record<Filter, string>>>;
}

/** One page of a list, normalized: what `load` returns, whatever envelope the backend used. */
export interface ListPage<Row> {
  readonly rows: readonly Row[];
  /** Rows in the whole result set. */
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  /** 0 for an empty result. */
  readonly lastPage: number;
  /** 1-based position of the first and last row on this page; 0 for an empty result. */
  readonly from: number;
  readonly to: number;
  /** Counts the server reports per view (the tabs' badges). */
  readonly views?: readonly { readonly key: string; readonly count?: number }[];
  /** Enrichment the backend adds next to the rows (authors, lookups), untouched. */
  readonly meta?: Readonly<Record<string, unknown>>;
  /** The `X-Request-ID` of the exchange, to quote in a bug report. */
  readonly requestId?: string | null;
}

export interface LoadContext {
  /** Aborted when a newer request supersedes this one, the list is disposed or the session changes. Pass it to the client. */
  readonly signal: AbortSignal;
}

/** The typed call a collection makes: the feature's API function. It never builds URLs in a view. */
export type CollectionLoader<Row, Sort extends string, Filter extends string, View extends string> = (
  query: CollectionQuery<Sort, Filter, View>,
  context: LoadContext,
) => Promise<ListPage<Row>>;

/** Where a list keeps its state between visits. */
export type CollectionStateSource =
  /** In the URL's query under `key`: survives reloads and back/forward, and record links carry it (`?from=`). */
  | { readonly kind: "url"; readonly key: string }
  /** In the component only. */
  | { readonly kind: "memory" };
