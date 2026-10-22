import { computed, inject, type ComputedRef } from "vue";
import { useI18n } from "vue-i18n";
import { routeLocationKey, routerKey, type RouteLocationNormalizedLoaded, type RouteLocationRaw, type Router } from "vue-router";
import { useOptionalPageChrome } from "./chrome";
import type { PageBack } from "./types";

/** The query parameter that makes a page lead back to the page the user came from: the origin's path with its query. */
export const BACK_PARAM = "back";
/** The origin's name ("Golf 1.6 TDI"), so the back link reads it even after a reload or from a copied link. */
export const BACK_TITLE_PARAM = "back_title";

const TITLE_LIMIT = 80;

/** Plain text for a label: trimmed, capped with an ellipsis; empty when there is nothing. */
function cleanTitle(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = value.trim();
  return text.length > TITLE_LIMIT ? `${text.slice(0, TITLE_LIMIT - 1).trimEnd()}…` : text;
}

/** The `back` (and `back_title`) of a route query, as it stands in the URL: untrusted. */
function carried(query: RouteLocationNormalizedLoaded["query"]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of [BACK_PARAM, BACK_TITLE_PARAM]) {
    const value = query[key];
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/** A query without the origin: a different record (the pager's) is not reached from the page the user came from. */
export function withoutBack(query: RouteLocationNormalizedLoaded["query"]): RouteLocationNormalizedLoaded["query"] {
  return Object.fromEntries(Object.entries(query).filter(([key]) => key !== BACK_PARAM && key !== BACK_TITLE_PARAM));
}

/** `to` with extra query parameters; a string path is resolved, so both forms come out the same. */
function withQuery(router: Router, to: RouteLocationRaw, extra: Record<string, string>): RouteLocationRaw {
  const target = router.resolve(to);
  return { path: target.path, query: { ...target.query, ...extra }, hash: target.hash };
}

/**
 * The back the current route asks for, or null: `?back=` must be a path of this application (one leading `/`, never `//`,
 * `/\` or a scheme) that resolves to a real page other than this one. The label is `?back_title=` (plain text, capped), else
 * the target route's `meta.titleKey`; without either there is no usable back.
 */
export function originBackOf(
  router: Router,
  route: RouteLocationNormalizedLoaded,
  translate: { t: (key: string) => string; te: (key: string) => boolean },
): PageBack | null {
  const raw = route.query[BACK_PARAM];
  if (typeof raw !== "string" || !/^\/(?![/\\])/.test(raw)) return null;
  const target = router.resolve(raw);
  const page = target.matched[target.matched.length - 1];
  // A catch-all ("not found") route matches any path, so it is no proof that the page exists.
  if (!page || page.path.includes("(.*)") || target.path === route.path) return null;
  let label = cleanTitle(route.query[BACK_TITLE_PARAM]);
  if (!label) {
    const key = [...target.matched].reverse().find((record) => typeof record.meta.titleKey === "string")?.meta.titleKey;
    if (key && translate.te(key)) label = cleanTitle(translate.t(key));
  }
  return label ? { label, to: target.fullPath } : null;
}

/** The back the current route asks for through `?back=`, reactive; the page shell puts it in place of the page's own back. */
export function useOriginBack(): ComputedRef<PageBack | null> {
  const router = inject(routerKey, null);
  const route = inject(routeLocationKey, null);
  const { t, te } = useI18n();
  return computed(() => (router && route ? originBackOf(router, route, { t: (key) => t(key), te: (key) => te(key) }) : null));
}

export interface BackLinks {
  /**
   * `to`, opened from this page: its page leads back here, with this page's name ("‹ Golf 1.6 TDI"). Call it in the template
   * (or a computed): the title is read when the page has loaded, so the link updates once the record's name is there.
   */
  backHere(to: RouteLocationRaw): RouteLocationRaw;
  /** `to`, carrying the back this page was opened with (create, then the saved record); `to` unchanged when there is none. */
  keepBack(to: RouteLocationRaw): RouteLocationRaw;
}

/**
 * The two link helpers of "back to where you came from": a link that leaves a record for another module uses `backHere`, a page
 * that hands the user on (a saved record) uses `keepBack`.
 *
 *   const { backHere } = useBackLinks();
 *   <RouterLink :to="backHere({ name: 'contracts.create' })">New contract</RouterLink>
 */
export function useBackLinks(): BackLinks {
  const router = inject(routerKey);
  const route = inject(routeLocationKey);
  if (!router || !route) throw new Error("useBackLinks needs vue-router installed on the app");
  const chrome = useOptionalPageChrome();
  return {
    backHere(to) {
      const title = cleanTitle(chrome?.title.value);
      return withQuery(router, to, { [BACK_PARAM]: route.fullPath, ...(title ? { [BACK_TITLE_PARAM]: title } : {}) });
    },
    keepBack(to) {
      const extra = carried(route.query);
      return extra[BACK_PARAM] ? withQuery(router, to, extra) : to;
    },
  };
}
