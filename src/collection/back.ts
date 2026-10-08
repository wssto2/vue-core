import { computed } from "vue";
import { useRoute, type RouteLocationRaw } from "vue-router";
import type { RecordListContext } from "../resource/listContext";
import type { CollectionDefinition } from "./definition";
import { LIST_CONTEXT_PARAM } from "./location";
import { decodeState, encodeState } from "./state";
import type { CollectionQuery } from "./types";

export interface CollectionBackOptions {
  /** The encoded list state the record was opened with: untrusted (it is in the URL). Default: the route's `?from=`. */
  from?: () => string | null | undefined;
  /** The list's route. */
  list: RouteLocationRaw;
  /** What the back link to the list says ("Tickets"); a function follows the locale. */
  backLabel: string | (() => string);
  /** The URL key the list keeps its state under. Default `"query"`. */
  stateKey?: string;
}

/** The list's route carrying `query` as its state; a string route is returned as it is. */
export function listRouteOf<Row, Sort extends string, Filter extends string, View extends string>(
  definition: CollectionDefinition<Row, Sort, Filter, View>,
  list: RouteLocationRaw,
  stateKey: string,
  query: CollectionQuery<Sort, Filter, View>,
): RouteLocationRaw {
  return typeof list === "string" ? list : { ...list, query: { ...list.query, [stateKey]: encodeState(definition, query) } };
}

/**
 * Back to the list a record was opened from, as the user left it, for a record page without a pager:
 * it decodes `?from=` through the list's definition and asks for nothing. A direct link (no or untrusted
 * state) leads to the plain list. Pass its result as `ResourcePage`'s `list`.
 */
export function useCollectionBack<Row, Sort extends string, Filter extends string, View extends string>(
  definition: CollectionDefinition<Row, Sort, Filter, View>,
  options: CollectionBackOptions,
): RecordListContext {
  const route = useRoute();
  const from = options.from ?? (() => (typeof route.query[LIST_CONTEXT_PARAM] === "string" ? (route.query[LIST_CONTEXT_PARAM] as string) : null));
  const to = computed(() => {
    const query = decodeState(definition, from());
    return query ? listRouteOf(definition, options.list, options.stateKey ?? "query", query) : options.list;
  });
  return {
    get back() {
      return { label: typeof options.backLabel === "function" ? options.backLabel() : options.backLabel, to: to.value };
    },
    neighbors: null,
  };
}
