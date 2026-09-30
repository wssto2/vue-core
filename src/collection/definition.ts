import type { CollectionLoader, CollectionQuery, SortDirection } from "./types";

/** The page sizes ARV's lists offer; a definition may narrow or replace them. */
export const DEFAULT_PAGE_SIZES: readonly number[] = [5, 8, 10, 15, 25, 50, 100];

/**
 * The query keys a list's backend supports. This is the contract the types and the URL validation
 * are built from: a DTO's property names do not say what the backend can sort or filter by, so it
 * is declared here (and validated server-side), never inferred from the row.
 */
export interface QueryContract<Sort extends string, Filter extends string, View extends string> {
  /** Sort keys the backend accepts. Omitted: any key that looks like an identifier. */
  readonly sorts?: readonly Sort[];
  /** Filter keys the backend accepts. Omitted: any key that looks like an identifier. */
  readonly filters?: readonly Filter[];
  /** Views (scopes) the backend accepts. Omitted: any key that looks like an identifier. */
  readonly views?: readonly View[];
  /**
   * Filters whose values must not appear in the URL or in a saved view (a person's ID number).
   * The list still filters by them; they are just not persisted, so a reload or a shared link
   * starts without them.
   */
  readonly sensitive?: readonly Filter[];
  /** Default: `DEFAULT_PAGE_SIZES`. */
  readonly pageSizes?: readonly number[];
}

export type CollectionDefaults<Sort extends string, Filter extends string, View extends string> = Partial<CollectionQuery<Sort, Filter, View>>;

/** The state a stored version of a list's state (a link, a saved view) is migrated from. */
export type StoredState = Readonly<Record<string, unknown>>;

export interface CollectionDefinitionInput<Row, Sort extends string, Filter extends string, View extends string> {
  /** Stable identity of the list: saved views and logs use it. It is not the URL key (two lists on a page each have their own). */
  readonly id: string;
  /** Bump it when the meaning of stored state changes (a renamed sort key); see `migrate`. */
  readonly stateVersion: number;
  /** The feature API's list function. */
  readonly load: CollectionLoader<Row, NoInfer<Sort>, NoInfer<Filter>, NoInfer<View>>;
  /** The record's identity: neighbors find the current record by it. */
  readonly key: (row: Row) => string | number;
  readonly defaults?: CollectionDefaults<NoInfer<Sort>, NoInfer<Filter>, NoInfer<View>>;
  readonly query?: QueryContract<Sort, Filter, View>;
  /**
   * Turns state stored under an older `stateVersion` into the current shape (the compact keys of
   * the URL format: `p l c d s f w`). Without it, state of another version is reset to the defaults.
   */
  readonly migrate?: (stored: StoredState, version: number) => StoredState | null;
}

/** A collection's definition: pure data and a loader. Nothing runs until `useCollection` or `useCollectionNeighbors` uses it. */
export interface CollectionDefinition<Row, Sort extends string = string, Filter extends string = string, View extends string = string> {
  readonly id: string;
  readonly stateVersion: number;
  readonly load: CollectionLoader<Row, Sort, Filter, View>;
  readonly key: (row: Row) => string | number;
  /** Complete: every field of the query has a value. */
  readonly defaults: CollectionQuery<Sort, Filter, View>;
  readonly contract: {
    readonly sorts: readonly Sort[] | null;
    readonly filters: readonly Filter[] | null;
    readonly views: readonly View[] | null;
    readonly sensitive: readonly Filter[];
    readonly pageSizes: readonly number[];
  };
  readonly migrate?: (stored: StoredState, version: number) => StoredState | null;
}

const DEFAULT_PAGE_SIZE = 25;

/**
 * Declares a list once: its loader, identity and query contract. The same definition serves the
 * list (`useCollection`) and the previous/next of a record page (`useCollectionNeighbors`), so both
 * ask the backend exactly the same question.
 *
 *   export const ticketList = (api: TicketsApi) => defineCollection({
 *     id: "helpdesk.tickets",
 *     stateVersion: 1,
 *     load: api.list,
 *     key: (ticket) => ticket.id,
 *     query: { sorts: ["created_at", "title"], filters: ["status", "assignee"] },
 *     defaults: { pageSize: 25, sort: "created_at", direction: "desc" },
 *   });
 *
 * Pure: it validates its input (and throws a descriptive error on a contradiction, e.g. a default
 * sort the contract does not list) but starts nothing.
 */
export function defineCollection<Row, Sort extends string = string, Filter extends string = string, View extends string = string>(
  input: CollectionDefinitionInput<Row, Sort, Filter, View>,
): CollectionDefinition<Row, Sort, Filter, View> {
  const where = `defineCollection("${input.id}")`;
  if (typeof input.id !== "string" || input.id.trim() === "") throw new Error("defineCollection: `id` must be a non-empty string.");
  if (!Number.isInteger(input.stateVersion) || input.stateVersion < 1) throw new Error(`${where}: \`stateVersion\` must be a positive integer.`);
  if (typeof input.load !== "function") throw new Error(`${where}: \`load\` must be a function.`);
  if (typeof input.key !== "function") throw new Error(`${where}: \`key\` must be a function.`);

  const contract = {
    sorts: input.query?.sorts ? [...input.query.sorts] : null,
    filters: input.query?.filters ? [...input.query.filters] : null,
    views: input.query?.views ? [...input.query.views] : null,
    sensitive: [...(input.query?.sensitive ?? [])],
    pageSizes: [...(input.query?.pageSizes ?? DEFAULT_PAGE_SIZES)],
  };
  if (contract.pageSizes.length === 0 || contract.pageSizes.some((size) => !Number.isInteger(size) || size < 1)) {
    throw new Error(`${where}: \`query.pageSizes\` must list positive integers.`);
  }
  for (const key of contract.sensitive) {
    if (contract.filters && !contract.filters.includes(key)) throw new Error(`${where}: sensitive filter "${key}" is not in \`query.filters\`.`);
  }

  const given = input.defaults ?? {};
  const pageSize = given.pageSize ?? (contract.pageSizes.includes(DEFAULT_PAGE_SIZE) ? DEFAULT_PAGE_SIZE : contract.pageSizes[0]!);
  if (!contract.pageSizes.includes(pageSize)) throw new Error(`${where}: default page size ${pageSize} is not one of ${contract.pageSizes.join(", ")}.`);
  const sort = given.sort ?? null;
  if (sort !== null && contract.sorts && !contract.sorts.includes(sort)) throw new Error(`${where}: default sort "${sort}" is not in \`query.sorts\`.`);
  const view = given.view ?? null;
  if (view !== null && contract.views && !contract.views.includes(view)) throw new Error(`${where}: default view "${view}" is not in \`query.views\`.`);
  const filters = Object.fromEntries(Object.entries(given.filters ?? {}).filter(([, value]) => value !== undefined && value !== ""));
  for (const key of Object.keys(filters)) {
    if (contract.filters && !contract.filters.includes(key as Filter)) throw new Error(`${where}: default filter "${key}" is not in \`query.filters\`.`);
  }
  const page = given.page ?? 1;
  if (!Number.isInteger(page) || page < 1) throw new Error(`${where}: default page must be a positive integer.`);
  const direction: SortDirection = given.direction ?? "asc";
  if (direction !== "asc" && direction !== "desc") throw new Error(`${where}: default direction must be "asc" or "desc".`);

  return Object.freeze({
    id: input.id,
    stateVersion: input.stateVersion,
    load: input.load as CollectionLoader<Row, Sort, Filter, View>,
    key: input.key,
    defaults: Object.freeze({
      page,
      pageSize,
      sort,
      direction,
      search: given.search ?? "",
      view,
      filters: Object.freeze(filters) as CollectionQuery<Sort, Filter, View>["filters"],
    }),
    contract: Object.freeze(contract),
    migrate: input.migrate,
  });
}

/** The row, sort keys, filter keys and views of a definition, for typing code written against it. */
export type RowOf<D> = D extends CollectionDefinition<infer Row, string, string, string> ? Row : never;
export type SortOf<D> = D extends CollectionDefinition<never, infer Sort, string, string> ? Sort : never;
export type FilterOf<D> = D extends CollectionDefinition<never, string, infer Filter, string> ? Filter : never;
export type ViewOf<D> = D extends CollectionDefinition<never, string, string, infer View> ? View : never;
