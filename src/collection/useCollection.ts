import {
  computed,
  getCurrentScope,
  hasInjectionContext,
  inject,
  onScopeDispose,
  ref,
  shallowRef,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";
import { routerKey, type RouteLocationRaw, type Router } from "vue-router";
import { isAborted } from "../client";
import type { AsyncState } from "../state";
import type { Column } from "./columns";
import { defineCollection, type CollectionDefinition } from "./definition";
import { isEmptyFilterValue, type FilterDescriptor, type ViewDescriptor } from "./filters";
import { LIST_CONTEXT_PARAM, withQuery } from "./location";
import type { SavedView, SavedViewState, SavedViews } from "./savedViews";
import { onSessionChange } from "./session";
import { decodeState, encodeState, restoreState, type Json } from "./state";
import type { ListPage, CollectionQuery, CollectionStateSource, SortDirection } from "./types";

/**
 * A link into a list carries plain parameters (`?scope=long`, `?followup=overdue`): a count on the
 * home page that opens its list filtered the same way. They are applied once when the list is created
 * and then dropped from the URL, so the list's own state takes over.
 */
export interface LinkedQuery<Filter extends string> {
  /** The parameter that names a view (default: no view parameter). Used only when it is one of the contract's views. */
  view?: string;
  /** Parameter to filter; a transform turns the parameter's text into the filter's value (`mine=1` into the user's id). `"any"` clears a filter the list sets by default. */
  params?: Readonly<Record<string, NoInfer<Filter> | { filter: NoInfer<Filter>; value: (text: string) => string | number | null }>>;
  /** Parameters that only label a filter (`line_name` for `line`): dropped along with it. */
  consume?: readonly string[];
}

export interface UseCollectionOptions<Row, Filter extends string, View extends string, Col extends Column<Row>, Sort extends string = string> {
  /** Where the list keeps its state; two lists on one page need two URL keys. */
  state: CollectionStateSource;
  columns?: MaybeRefOrGetter<readonly Col[]>;
  filters?: MaybeRefOrGetter<readonly FilterDescriptor<NoInfer<Filter>>[]>;
  views?: MaybeRefOrGetter<readonly ViewDescriptor<NoInfer<View>>[]>;
  /** Where a row's record lives. Record links carry the list's state (`?from=`) so the record page can step through the list. */
  recordRoute?: (row: Row) => RouteLocationRaw;
  /** Offers "Saved views" on the list. */
  savedViews?: SavedViews;
  linked?: LinkedQuery<Filter>;
  /**
   * This use's starting state, over the definition's `defaults` (each field given replaces the
   * definition's): where the list opens when the URL holds none, and what `reset()` returns to. A list
   * that opens on the user's own location starts here. It is where the list starts, not a search the
   * user ran: `isFiltered` (so `display`) counts a filter or the search only when it differs from it,
   * so an empty result under the start is `"empty"`, not `"no-matches"`. Clearing the filter shows
   * everything, and the start is still sent to the backend like any filter.
   */
  defaults?: Readonly<{ filters?: Readonly<Partial<Record<NoInfer<Filter>, string>>>; search?: string; view?: NoInfer<View> | null; sort?: NoInfer<Sort> | null; direction?: SortDirection }>;
}

/** What the list shows, derived from its state: one branch to render per value. */
export type CollectionDisplay =
  /** A request for the current query is running and there is nothing to show yet: skeleton rows. */
  | "loading"
  | "failed"
  /** Loaded, no rows, and nothing narrows the list: nothing exists yet. */
  | "empty"
  /** Loaded, no rows, while a search or filter applies: they produced nothing. */
  | "no-matches"
  | "rows";

export interface SavedViewsHandle {
  /** The saved views this list can apply (those of another state version that cannot be migrated are left out). */
  readonly items: Readonly<Ref<readonly SavedView[]>>;
  readonly status: Readonly<Ref<"idle" | "loading" | "ready" | "failed">>;
  /** Loads the list's saved views; safe to call again. */
  load(): Promise<void>;
  /** The state a save would store: the list's filters, search and view. */
  current(): SavedViewState;
  /** Saves under a name (an existing name is replaced); `state` overrides parts of `current()` (the filter panel's unapplied draft). */
  save(name: string, state?: Partial<Pick<SavedViewState, "filters" | "search" | "view">>): Promise<SavedView>;
  apply(view: SavedView): void;
  /**
   * Removal for an undo toast: the view leaves the list at once; `revert` puts it back and `commit`
   * deletes it on the server (skipped when it was saved again under the same name meanwhile).
   */
  stageRemoval(id: SavedView["id"]): { revert(): void; commit(): Promise<void> };
}

/**
 * The handle of one list: its state, the loaded page and the commands that change either. Commands
 * batch into one request (several calls in a tick load once), a newer request supersedes the older,
 * and a failure is never confused with an empty list.
 */
export interface Collection<Row, Sort extends string = string, Filter extends string = string, View extends string = string, Col extends Column<Row> = Column<Row>> {
  /** The definition's id. */
  readonly id: string;
  /** The record's identity (the definition's `key`): what rows are keyed by. */
  rowKey(row: Row): string | number;
  /** The page sizes the list offers. */
  readonly pageSizes: readonly number[];
  /** Whether the list can be searched by text (the definition's `query.search`); the toolbar shows the search field only then. */
  readonly searchable: boolean;
  /** The request state: loading (nothing to show), loaded, refreshing (previous rows stay), stale (a refresh failed, previous rows stay) or failed. */
  readonly state: Readonly<Ref<AsyncState<ListPage<Row>>>>;
  /** The query the list shows or is loading. */
  readonly query: Readonly<Ref<CollectionQuery<Sort, Filter, View>>>;
  /** The last page that loaded, kept while another loads, refreshes or fails (so the pager and the count stay); null before the first and after a session change. */
  readonly page: ComputedRef<ListPage<Row> | null>;
  readonly rows: ComputedRef<readonly Row[]>;
  readonly total: ComputedRef<number>;
  readonly display: ComputedRef<CollectionDisplay>;
  /** A search or a filter applies; one that is the use's starting state (`defaults`) does not count. */
  readonly isFiltered: ComputedRef<boolean>;
  /** The failure of the last request (an `ApiError` for requests made through the client); null when it did not fail. */
  readonly error: Readonly<Ref<unknown>>;
  readonly columns: ComputedRef<readonly Col[]>;
  readonly filters: ComputedRef<readonly FilterDescriptor<Filter>[]>;
  /** The views with the counts the server reported. */
  readonly views: ComputedRef<readonly ViewDescriptor<View>[]>;
  /** Null when the list was created without a `savedViews` adapter. */
  readonly savedViews: SavedViewsHandle | null;
  /** Loads the current query again; previous rows stay on screen meanwhile. Resolves when the request has ended. */
  refresh(): Promise<void>;
  goToPage(page: number): void;
  nextPage(): void;
  previousPage(): void;
  setPageSize(size: number): void;
  sortBy(key: Sort, direction?: SortDirection): void;
  /** The same key flips the direction; another key sorts ascending. */
  toggleSort(key: Sort): void;
  search(text: string): void;
  /** Sets one filter; null, undefined and "" clear it. Back to page 1. */
  setFilter(key: Filter, value: string | number | null | undefined): void;
  /** Sets several filters at once (the filter panel's Apply): one request. */
  setFilters(values: Readonly<Partial<Record<Filter, string | number | null | undefined>>>): void;
  /** Clears every filter and the search. */
  clearFilters(): void;
  setView(view: View | null): void;
  /** Back to the starting state: the use's `defaults` over the definition's. */
  reset(): void;
  /** The link of a row's record, carrying the list's state; null without `recordRoute`. */
  recordLocation(row: Row): RouteLocationRaw | null;
  /** `{ from }` to add to a link to any record of this list; empty for a list that keeps no state in the URL. */
  linkContext(): Record<string, string>;
}

// Two lists of one page must not share a URL key. A claim is (route path, key): a list leaving
// while the next page enters shares the key but not the path, and a remounted list is the same id.
const claims = new WeakMap<Router, Map<string, { id: string; count: number }>>();

function claim(router: Router, id: string, path: string, key: string): () => void {
  let byKey = claims.get(router);
  if (!byKey) claims.set(router, (byKey = new Map()));
  const slot = `${path}\u0000${key}`;
  const held = byKey.get(slot);
  if (held && held.id !== id) {
    throw new Error(
      `useCollection("${id}"): the URL state key "${key}" is already used by the list "${held.id}" on this page. ` +
        `Two lists on one page each need their own \`state: { kind: "url", key }\`, or they overwrite each other's state.`,
    );
  }
  const entry = held ?? { id, count: 0 };
  entry.count++;
  byKey.set(slot, entry);
  return () => {
    if (--entry.count <= 0) byKey.delete(slot);
  };
}

const hasValue = <T>(state: AsyncState<T>): state is Extract<AsyncState<T>, { value: T }> =>
  state.status === "loaded" || state.status === "refreshing" || state.status === "stale";

const messageOf = (error: unknown): string => (error instanceof Error && error.message !== "" ? error.message : String(error));

/**
 * The state of one list. Call it while a component is set up (a URL state needs the app's router).
 *
 *   const list = useCollection(tickets, {
 *     columns,
 *     state: { kind: "url", key: "query" },
 *     recordRoute: (ticket) => ticketRoutes.record({ ticketID: ticket.id }),
 *   });
 *
 * It loads once on creation (after the synchronous setup that may adjust filters), keeps the latest
 * request only, treats a cancelled request as nothing happened, and follows the URL when the
 * user goes back or forward. It stops with the scope it was created in.
 */
export function useCollection<Row, Sort extends string, Filter extends string, View extends string, const Col extends Column<Row> = Column<Row>>(
  definition: CollectionDefinition<Row, Sort, Filter, View>,
  options: UseCollectionOptions<Row, Filter, View, Col, Sort>,
): Collection<Row, Sort, Filter, View, Col> {
  const where = `useCollection("${definition.id}")`;
  const source = options.state;
  let router: Router | null = null;
  let ownPath = "";
  let urlKey = "";
  let release = (): void => {};

  if (source.kind === "url") {
    router = hasInjectionContext() ? inject(routerKey, null) : null;
    if (!router) throw new Error(`${where}: a URL state needs the application's router. Call it while a component is being set up, with the router installed, or use \`state: { kind: "memory" }\`.`);
    if (!source.key) throw new Error(`${where}: \`state.key\` must not be empty.`);
    urlKey = source.key;
    ownPath = router.currentRoute.value.path;
    release = claim(router, definition.id, ownPath, urlKey);
  }

  // --- state -------------------------------------------------------------------------------------

  // The state the list starts from and `reset()` returns to: this use's `defaults` over the definition's, validated like the definition's own.
  const begin: CollectionQuery<Sort, Filter, View> = options.defaults
    ? defineCollection({
        ...definition,
        query: { ...definition.contract, sorts: definition.contract.sorts ?? undefined, filters: definition.contract.filters ?? undefined, views: definition.contract.views ?? undefined },
        defaults: { ...definition.defaults, ...options.defaults },
      }).defaults
    : definition.defaults;
  // Narrowing is measured against what the use gave, not the definition's defaults: those count as before.
  const given = { search: options.defaults?.search ?? "", filters: (options.defaults?.filters ?? {}) as Readonly<Partial<Record<Filter, string>>> };
  const startOption = options.defaults ? begin : undefined;
  const start = (() => {
    if (!router) return begin;
    const raw = router.currentRoute.value.query[urlKey];
    return decodeState(definition, Array.isArray(raw) ? raw[0] : raw, startOption) ?? begin;
  })();
  const query = shallowRef<CollectionQuery<Sort, Filter, View>>(start);
  const state = shallowRef<AsyncState<ListPage<Row>>>({ status: "loading" });
  const error = shallowRef<unknown>(null);
  // The last page that loaded, kept through loading and failures: the pager and the count must not flicker to nothing between pages.
  const known = shallowRef<ListPage<Row> | null>(null);
  const page = computed(() => (hasValue(state.value) ? state.value.value : known.value));

  let disposed = false;
  let controller: AbortController | null = null;
  let sequence = 0;
  let scheduled = false;
  const consumed: string[] = [];

  // Applies the plain parameters of a link into the list, once.
  if (router && options.linked) applyLinked(router.currentRoute.value.query as Readonly<Record<string, unknown>>, options.linked);

  function applyLinked(params: Readonly<Record<string, unknown>>, linked: LinkedQuery<Filter>) {
    let next = query.value;
    const text = (name: string) => {
      const value = params[name];
      const first = Array.isArray(value) ? value[0] : value;
      return typeof first === "string" && first !== "" ? first : null;
    };
    if (linked.view) {
      const view = text(linked.view);
      const allowed = view !== null && (definition.contract.views ? (definition.contract.views as readonly string[]).includes(view) : true);
      if (view !== null && allowed) {
        next = { ...next, view: view as View, page: 1 };
        consumed.push(linked.view);
      }
    }
    for (const [name, target] of Object.entries(linked.params ?? {})) {
      const given = text(name);
      if (given === null) continue;
      const filter = typeof target === "string" ? target : target.filter;
      const resolved = typeof target === "string" ? given : target.value(given);
      const filters = { ...next.filters } as Partial<Record<Filter, string>>;
      if (resolved === null || resolved === "any" || resolved === "") delete filters[filter];
      else filters[filter] = String(resolved);
      next = { ...next, filters, page: 1 };
      consumed.push(name);
    }
    if (consumed.length > 0) {
      for (const name of linked.consume ?? []) if (name in params) consumed.push(name);
      query.value = next;
    }
  }

  // --- loading -----------------------------------------------------------------------------------

  async function run(keepRows: boolean): Promise<void> {
    if (disposed) return;
    controller?.abort();
    const mine = ++sequence;
    const current = (controller = new AbortController());
    const before = state.value;
    const asked = query.value;
    state.value = keepRows && hasValue(before) ? { status: "refreshing", value: before.value } : { status: "loading" };

    try {
      const loaded = await definition.load(asked, { signal: current.signal });
      if (mine !== sequence) return;
      const beyond = loaded.lastPage >= 1 && asked.page > loaded.lastPage;
      if (beyond) {
        // The last page emptied (rows were deleted, filters narrowed): go to the new last page instead of showing nothing.
        query.value = { ...asked, page: loaded.lastPage };
        queueUrlWrite();
        void run(false);
        return;
      }
      error.value = null;
      known.value = loaded;
      state.value = { status: "loaded", value: loaded };
    } catch (failure) {
      // A request that was cancelled (superseded, disposed, the session changed) did not fail.
      if (mine !== sequence || current.signal.aborted || isAborted(failure)) return;
      error.value = failure;
      state.value = keepRows && hasValue(before) ? { status: "stale", value: before.value, error: messageOf(failure) } : { status: "failed", error: messageOf(failure) };
    }
  }

  function changed() {
    queueUrlWrite();
    if (scheduled || disposed) return;
    scheduled = true;
    queueMicrotask(() => {
      if (!scheduled) return; // `refresh()` ran it already
      scheduled = false;
      void run(false);
    });
  }

  function refresh(): Promise<void> {
    scheduled = false;
    return run(true);
  }

  // --- the URL -----------------------------------------------------------------------------------

  let writeQueued = false;
  let writing = false;
  let again = false;

  function queueUrlWrite() {
    if (!router || writeQueued || disposed) return;
    writeQueued = true;
    queueMicrotask(() => {
      writeQueued = false;
      void writeUrl();
    });
  }

  async function writeUrl(): Promise<void> {
    if (!router) return;
    if (writing) {
      again = true;
      return;
    }
    writing = true;
    try {
      do {
        again = false;
        const here = router.currentRoute.value;
        // Only this list's own page: a write after the user navigated away would change the next page's URL.
        if (disposed || here.path !== ownPath) return;
        const encoded = encodeState(definition, query.value, startOption);
        const rest = { ...here.query };
        for (const name of consumed.splice(0)) delete rest[name];
        if (here.query[urlKey] === encoded && Object.keys(rest).length === Object.keys(here.query).length) continue;
        await router.replace({ query: { ...rest, [urlKey]: encoded }, hash: here.hash });
      } while (again);
    } catch {
      // A redirecting guard or a cancelled navigation: the URL is a convenience, the list keeps its state.
    } finally {
      writing = false;
    }
  }

  // Back and forward, or a link to the same list with another state: the URL wins.
  const stopWatchingUrl = router
    ? watch(
        () => router!.currentRoute.value.query[urlKey],
        (raw) => {
          const here = router!.currentRoute.value;
          if (disposed || writing || here.path !== ownPath) return;
          const stored = Array.isArray(raw) ? raw[0] : raw;
          const next = decodeState(definition, stored, startOption) ?? begin;
          if (JSON.stringify(next) !== JSON.stringify(query.value)) {
            query.value = next;
            changed();
          } else queueUrlWrite(); // the same state in another spelling (ARV's link): write it canonically
        },
      )
    : () => {};

  // --- commands ----------------------------------------------------------------------------------

  const commit = (next: Partial<CollectionQuery<Sort, Filter, View>>, resetPage = false) => {
    query.value = { ...query.value, ...next, ...(resetPage ? { page: 1 } : {}) };
    changed();
  };

  const filtersWith = (values: Readonly<Partial<Record<Filter, string | number | null | undefined>>>) => {
    const filters = { ...query.value.filters } as Partial<Record<Filter, string>>;
    for (const [key, value] of Object.entries(values) as [Filter, string | number | null | undefined][]) {
      if (value === null || value === undefined || isEmptyFilterValue(value)) delete filters[key];
      else filters[key] = String(value);
    }
    return filters;
  };

  const isFiltered = computed(
    () => (query.value.search !== "" && query.value.search !== given.search) || Object.entries(query.value.filters).some(([key, value]) => !isEmptyFilterValue(value) && value !== given.filters[key as Filter]),
  );
  const rows = computed(() => page.value?.rows ?? []);
  const display = computed<CollectionDisplay>(() => {
    const current = state.value;
    if (current.status === "loading") return "loading";
    if (current.status === "failed") return "failed";
    if (current.value.rows.length > 0) return "rows";
    return isFiltered.value ? "no-matches" : "empty";
  });

  const views = computed(() => {
    const counts = new Map((page.value?.views ?? []).map((view) => [view.key, view.count]));
    return (toValue(options.views) ?? []).map((view) => (counts.has(view.key) ? { ...view, count: counts.get(view.key) } : view));
  });

  // --- saved views -------------------------------------------------------------------------------

  let clearSaved = (): void => {};
  const savedViews = options.savedViews ? createSavedViewsHandle(options.savedViews) : null;

  function storedOf(view: SavedView): CollectionQuery<Sort, Filter, View> | null {
    const stored: Json = { v: view.state.version, f: view.state.filters, s: view.state.search, w: view.state.view ?? undefined };
    return restoreState(definition, stored, startOption);
  }

  function createSavedViewsHandle(adapter: SavedViews): SavedViewsHandle {
    const all = ref<readonly SavedView[]>([]);
    const status = ref<"idle" | "loading" | "ready" | "failed">("idle");
    let loading: AbortController | null = null;
    const byName = (a: SavedView, b: SavedView) => a.name.localeCompare(b.name);
    const items = computed(() => all.value.filter((view) => storedOf(view) !== null));
    clearSaved = () => {
      loading?.abort();
      all.value = [];
      status.value = "idle";
    };

    const current = (): SavedViewState => ({
      version: definition.stateVersion,
      filters: Object.fromEntries(Object.entries(query.value.filters).filter(([key, value]) => value !== undefined && !(definition.contract.sensitive as readonly string[]).includes(key))) as Record<string, string>,
      search: query.value.search,
      view: query.value.view,
    });

    return {
      items,
      status,
      async load() {
        loading?.abort();
        const mine = (loading = new AbortController());
        status.value = "loading";
        try {
          const found = await adapter.list(definition.id, { signal: mine.signal });
          if (mine.signal.aborted) return;
          all.value = [...found].sort(byName);
          status.value = "ready";
        } catch (failure) {
          if (mine.signal.aborted || isAborted(failure)) return;
          status.value = "failed";
        }
      },
      current,
      async save(name, overrides) {
        const saved = await adapter.save(definition.id, name, { ...current(), ...overrides });
        all.value = [...all.value.filter((view) => view.id !== saved.id), saved].sort(byName);
        return saved;
      },
      apply(view) {
        const restored = storedOf(view);
        if (!restored) return;
        commit({ filters: restored.filters, search: restored.search, view: view.state.view ? restored.view : query.value.view }, true);
      },
      stageRemoval(id) {
        const removed = all.value.find((view) => view.id === id) ?? null;
        all.value = all.value.filter((view) => view.id !== id);
        return {
          revert() {
            if (removed && !all.value.some((view) => view.id === id)) all.value = [...all.value, removed].sort(byName);
          },
          // Saved again under the same name while the toast was up: the server replaced that very row, it must not be deleted now.
          async commit() {
            if (all.value.some((view) => view.id === id)) return;
            await adapter.remove(definition.id, id);
          },
        };
      },
    };
  }

  // --- lifecycle ---------------------------------------------------------------------------------

  function dispose() {
    if (disposed) return;
    disposed = true;
    controller?.abort();
    sequence++;
    stopWatchingUrl();
    release();
  }
  if (getCurrentScope()) onScopeDispose(dispose);

  // One person's data must not reach the next session: drop the page and what was saved, and load again for the new person.
  onSessionChange((identity) => {
    controller?.abort();
    sequence++;
    state.value = { status: "loading" };
    known.value = null;
    error.value = null;
    clearSaved();
    if (identity !== null) changed();
  });

  changed(); // the one initial load, after the setup that created the list has finished adjusting it

  return {
    id: definition.id,
    pageSizes: definition.contract.pageSizes,
    searchable: definition.contract.search,
    rowKey: (row) => definition.key(row),
    state,
    query,
    page,
    rows,
    total: computed(() => page.value?.total ?? 0),
    display,
    isFiltered,
    error,
    columns: computed(() => {
      const columns = toValue(options.columns) ?? [];
      const sorts = definition.contract.sorts as readonly string[] | null;
      // A column's `sort` is checked against the contract when the columns are read: a typo is an error at setup, not a header that sorts by nothing.
      if (sorts) for (const column of columns) if (column.sort !== undefined && !sorts.includes(column.sort)) throw new Error(`${where}: column "${column.key}" sorts by "${column.sort}", which is not in the query contract's sorts (${sorts.join(", ")}).`);
      return columns;
    }),
    filters: computed(() => toValue(options.filters) ?? []),
    views,
    savedViews,
    refresh,
    goToPage: (next) => {
      if (Number.isInteger(next) && next >= 1 && next !== query.value.page) commit({ page: next });
    },
    nextPage: () => {
      const last = page.value?.lastPage ?? 0;
      if (query.value.page < last) commit({ page: query.value.page + 1 });
    },
    previousPage: () => {
      if (query.value.page > 1) commit({ page: query.value.page - 1 });
    },
    setPageSize: (size) => {
      if (definition.contract.pageSizes.includes(size) && size !== query.value.pageSize) commit({ pageSize: size }, true);
    },
    sortBy: (key, direction = "asc") => {
      if (definition.contract.sorts && !definition.contract.sorts.includes(key)) throw new Error(`${where}: "${key}" is not in the query contract's sorts.`);
      commit({ sort: key, direction });
    },
    toggleSort: (key) => {
      const current = query.value;
      commit({ sort: key, direction: current.sort === key && current.direction === "asc" ? "desc" : "asc" });
    },
    search: (text) => commit({ search: text }, true),
    setFilter: (key, value) => commit({ filters: filtersWith({ [key]: value } as Partial<Record<Filter, string | number | null>>) }, true),
    setFilters: (values) => commit({ filters: filtersWith(values) }, true),
    clearFilters: () => commit({ filters: {} as CollectionQuery<Sort, Filter, View>["filters"], search: "" }, true),
    setView: (view) => commit({ view }, true),
    reset: () => {
      query.value = begin;
      changed();
    },
    recordLocation: (row) => {
      const target = options.recordRoute?.(row);
      if (!target) return null;
      return router ? withQuery(target, { [LIST_CONTEXT_PARAM]: encodeState(definition, query.value, startOption) }) : target;
    },
    linkContext: () => (router ? { [LIST_CONTEXT_PARAM]: encodeState(definition, query.value, startOption) } : {}) as Record<string, string>,
  };
}
