import { getCurrentScope, onScopeDispose, ref, shallowRef, watch, type Ref } from "vue";
import { useRoute, type RouteLocationRaw } from "vue-router";
import { isAborted } from "../client";
import type { CollectionDefinition } from "./definition";
import { LIST_CONTEXT_PARAM } from "./location";
import { onSessionChange } from "./session";
import { decodeState, encodeState, queryKey } from "./state";
import type { ListPage, CollectionQuery } from "./types";

/** The previous or next record of the list a record page was opened from. */
export interface Neighbor {
  /** The record's key (`definition.key`). */
  readonly key: string | number;
  /** The record page of that neighbor, carrying its own list state (the page it lives on), so "back to the list" lands on it. */
  readonly to: RouteLocationRaw;
}

export interface CollectionNeighbors {
  /** 1-based position of the current record in the whole result set; null when the page was not opened from a list or the record is no longer in it. */
  readonly position: Readonly<Ref<number | null>>;
  readonly total: Readonly<Ref<number>>;
  readonly previous: Readonly<Ref<Neighbor | null>>;
  readonly next: Readonly<Ref<Neighbor | null>>;
  readonly loading: Readonly<Ref<boolean>>;
  /** The list as the user left it (its route with the state in the query); null without list state. */
  readonly listRoute: Readonly<Ref<RouteLocationRaw | null>>;
}

export interface NeighborOptions {
  /** The encoded list state the record was opened with: untrusted (it is in the URL). Default: the route's `?from=`. No state means a direct link: nothing is requested. */
  from?: () => string | null | undefined;
  /** The key of the record being shown. */
  current: () => string | number | null | undefined;
  /** The list's route, for `listRoute`. */
  list: RouteLocationRaw;
  /** The record route's parameter that holds the key: a neighbor's page is the current route with this parameter replaced. */
  param: string;
  /** The URL key the list keeps its state under. Default `"query"`. */
  stateKey?: string;
}

/** Pages kept per page of results; stepping through records costs a request only at page boundaries. */
const CACHE_PAGES = 8;

/**
 * Previous and next record for a record page opened from a list: the list's encoded state (page,
 * sort, search, filters, view) travels in `?from=`, and this replays that exact query through the
 * same definition (and so the same loader) as the list, finds the current record and its
 * neighbors. It fetches the page the state points at, and an adjacent page only when the record is
 * the first or last on its page. Pages are cached per query in a small bounded cache; a failed page
 * is not cached. Everything is dropped when the session changes.
 */
export function useCollectionNeighbors<Row, Sort extends string, Filter extends string, View extends string>(
  definition: CollectionDefinition<Row, Sort, Filter, View>,
  options: NeighborOptions,
): CollectionNeighbors {
  const route = useRoute();
  const from = options.from ?? (() => (typeof route.query[LIST_CONTEXT_PARAM] === "string" ? (route.query[LIST_CONTEXT_PARAM] as string) : null));
  const stateKey = options.stateKey ?? "query";

  const position = ref<number | null>(null);
  const total = ref(0);
  const previous = shallowRef<Neighbor | null>(null);
  const next = shallowRef<Neighbor | null>(null);
  const loading = ref(false);
  const listRoute = shallowRef<RouteLocationRaw | null>(null);

  const cache = new Map<string, Promise<ListPage<Row>>>();
  let generation = 0;
  // Pages are shared between steps, so they are cancelled together (disposal, session change), never per step.
  let lifetime = new AbortController();
  let disposed = false;

  function fetchPage(query: CollectionQuery<Sort, Filter, View>, page: number, signal: AbortSignal): Promise<ListPage<Row> | null> {
    const asked = { ...query, page };
    const key = queryKey(asked);
    let request = cache.get(key);
    if (request) {
      cache.delete(key); // refresh its place: the Map order is the recency order
    } else {
      request = (async () => definition.load(asked, { signal }))(); // a loader that throws synchronously becomes a rejection too
      // A failure or a cancellation must not stay cached: the next step asks again.
      request.catch(() => {
        if (cache.get(key) === request) cache.delete(key);
      });
    }
    cache.set(key, request);
    while (cache.size > CACHE_PAGES) cache.delete(cache.keys().next().value as string);
    return request.catch((failure: unknown) => {
      if (isAborted(failure)) throw failure;
      return null;
    });
  }

  function reset() {
    position.value = null;
    previous.value = null;
    next.value = null;
    total.value = 0;
    listRoute.value = null;
  }

  async function resolve() {
    const mine = ++generation;
    const signal = lifetime.signal;
    const query = decodeState(definition, from());
    const current = options.current();

    if (!query || current === null || current === undefined || current === "") {
      reset();
      loading.value = false;
      return;
    }

    loading.value = true;
    // Never leave the previous record's neighbors in place while resolving: a quick second step would start from the wrong record.
    previous.value = null;
    next.value = null;
    const indexIn = (data: ListPage<Row> | null) => (data ? data.rows.findIndex((row) => String(definition.key(row)) === String(current)) : -1);
    const at = (page: number, key: string | number): Neighbor => {
      const state = encodeState(definition, { ...query, page });
      return { key, to: { name: route.name ?? undefined, params: { ...route.params, [options.param]: String(key) }, query: { ...route.query, [LIST_CONTEXT_PARAM]: state }, hash: route.hash } };
    };

    try {
      let page = query.page;
      let data = await fetchPage(query, page, signal);
      let index = indexIn(data);

      // The state names the page the user left the list on; after a re-sort or a change in the data the record may have slipped to a neighboring page.
      for (const candidate of [page - 1, page + 1]) {
        if (index !== -1 || !data || candidate < 1 || candidate > data.lastPage) continue;
        const other = await fetchPage(query, candidate, signal);
        const otherIndex = indexIn(other);
        if (other && otherIndex !== -1) {
          page = candidate;
          data = other;
          index = otherIndex;
        }
      }
      if (mine !== generation) return;
      if (!data || index === -1) {
        reset();
        return;
      }

      const size = data.pageSize || query.pageSize;
      const rows = data.rows;
      let before: Neighbor | null = null;
      if (index > 0) before = at(page, definition.key(rows[index - 1]!));
      else if (page > 1) {
        const earlier = await fetchPage(query, page - 1, signal);
        const last = earlier?.rows[earlier.rows.length - 1];
        if (last !== undefined) before = at(page - 1, definition.key(last));
      }
      let after: Neighbor | null = null;
      if (index < rows.length - 1) after = at(page, definition.key(rows[index + 1]!));
      else if (page < data.lastPage) {
        const later = await fetchPage(query, page + 1, signal);
        const first = later?.rows[0];
        if (first !== undefined) after = at(page + 1, definition.key(first));
      }
      if (mine !== generation) return;

      total.value = data.total;
      position.value = (page - 1) * size + index + 1;
      previous.value = before;
      next.value = after;
      const target = options.list;
      listRoute.value = typeof target === "string" ? target : { ...target, query: { ...target.query, [stateKey]: encodeState(definition, { ...query, page }) } };
    } catch (failure) {
      if (!isAborted(failure)) throw failure; // anything else was turned into "no data" by fetchPage
    } finally {
      if (mine === generation) loading.value = false;
    }
  }

  const stop = watch([from, options.current], resolve, { immediate: true });

  function dispose() {
    if (disposed) return;
    disposed = true;
    generation++;
    lifetime.abort();
    stop();
    cache.clear();
  }
  if (getCurrentScope()) onScopeDispose(dispose);

  onSessionChange(() => {
    lifetime.abort();
    lifetime = new AbortController();
    cache.clear();
    void resolve();
  });

  return { position, total, previous, next, loading, listRoute };
}
