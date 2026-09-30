import type { RouteLocationRaw } from "vue-router";

/** The query parameter a record link carries so its page can step through the list the user came from. */
// A template literal on purpose: the import-boundary script's pattern would read a quoted word there as an import specifier.
export const LIST_CONTEXT_PARAM = `from`;

/** `target` with extra query parameters, whatever form the location takes. */
export function withQuery(target: RouteLocationRaw, extra: Readonly<Record<string, string>>): RouteLocationRaw {
  if (typeof target === "string") {
    const query = new URLSearchParams(extra).toString();
    const hash = target.indexOf("#");
    const path = hash === -1 ? target : target.slice(0, hash);
    return `${path}${path.includes("?") ? "&" : "?"}${query}${hash === -1 ? "" : target.slice(hash)}`;
  }
  return { ...target, query: { ...target.query, ...extra } } as RouteLocationRaw;
}
