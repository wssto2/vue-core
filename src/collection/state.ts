import type { CollectionDefinition } from "./definition";
import type { CollectionQuery, SortDirection } from "./types";

/*
 * The state of a list as text, for the URL (`?query=…`), a record link's `from` and saved views.
 *
 * The format is ARV's compact one, base64url of JSON, so existing links and bookmarks keep working:
 *   p page · l page size · c sort key · d direction · s search · f filters
 * plus two keys ARV never wrote: w view (the scope tab, which ARV lost on reload and in previous/next)
 * and v the definition's stateVersion. A link without `v` is ARV's and is read as the current version.
 *
 * Everything read back is untrusted (anyone can edit a URL): every field is validated against the
 * definition's contract and replaced by its default when it does not hold, never passed on.
 */

const MAX_ENCODED = 4096;
const MAX_TEXT = 200;
const MAX_FILTERS = 32;
const MAX_PAGE = 1_000_000;
const IDENTIFIER = /^[A-Za-z0-9_.-]{1,64}$/;

export type Json = Readonly<Record<string, unknown>>;

function toBase64Url(text: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): string {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);

function text(value: unknown, max = MAX_TEXT): string | null {
  return typeof value === "string" && value.length <= max ? value : null;
}

/** The query of `candidate` (untrusted, compact keys) made valid for `definition`: every bad field is its default. */
export function sanitizeState<Row, Sort extends string, Filter extends string, View extends string>(
  definition: CollectionDefinition<Row, Sort, Filter, View>,
  candidate: Json,
): CollectionQuery<Sort, Filter, View> {
  const { defaults, contract } = definition;

  const page = typeof candidate.p === "number" && Number.isInteger(candidate.p) && candidate.p >= 1 && candidate.p <= MAX_PAGE ? candidate.p : defaults.page;
  const pageSize = typeof candidate.l === "number" && contract.pageSizes.includes(candidate.l) ? candidate.l : defaults.pageSize;

  let sort: Sort | null = defaults.sort;
  const sortText = text(candidate.c, 64);
  if (sortText !== null && (contract.sorts ? (contract.sorts as readonly string[]).includes(sortText) : IDENTIFIER.test(sortText))) sort = sortText as Sort;

  const direction: SortDirection = candidate.d === "asc" || candidate.d === "desc" ? candidate.d : defaults.direction;
  const search = text(candidate.s) ?? defaults.search;

  let view: View | null = defaults.view;
  const viewText = text(candidate.w, 64);
  if (viewText !== null && (contract.views ? (contract.views as readonly string[]).includes(viewText) : IDENTIFIER.test(viewText))) view = viewText as View;

  // A stored `f` replaces the default filters (a cleared default stays cleared); without one the defaults apply.
  const filters: Partial<Record<Filter, string>> = isRecord(candidate.f) ? {} : { ...defaults.filters };
  if (isRecord(candidate.f)) {
    let count = 0;
    for (const [key, raw] of Object.entries(candidate.f)) {
      if (++count > MAX_FILTERS) break;
      const allowed = contract.filters ? (contract.filters as readonly string[]).includes(key) : IDENTIFIER.test(key);
      if (!allowed || (contract.sensitive as readonly string[]).includes(key)) continue;
      const value = typeof raw === "number" || typeof raw === "boolean" ? String(raw) : text(raw);
      if (value !== null && value !== "") filters[key as Filter] = value;
    }
  }

  return { page, pageSize, sort, direction, search, view, filters };
}

/** The compact text of a query. Sensitive filters are left out. */
export function encodeState<Row, Sort extends string, Filter extends string, View extends string>(
  definition: CollectionDefinition<Row, Sort, Filter, View>,
  query: CollectionQuery<Sort, Filter, View>,
): string {
  const compact: Record<string, unknown> = { v: definition.stateVersion, p: query.page, l: query.pageSize };
  if (query.sort) compact.c = query.sort;
  compact.d = query.direction;
  if (query.search) compact.s = query.search;
  if (query.view) compact.w = query.view;
  const filters = Object.fromEntries(
    Object.entries(query.filters).filter(([key, value]) => value !== undefined && value !== "" && !(definition.contract.sensitive as readonly string[]).includes(key)),
  );
  if (Object.keys(filters).length > 0 || Object.keys(definition.defaults.filters).length > 0) compact.f = filters;
  return toBase64Url(JSON.stringify(compact));
}

/**
 * The query stored (compact keys, as a link or a saved view holds them) under `stored.v`, migrated if
 * it is of another version: null when the definition cannot read it (the caller then keeps what it has).
 */
export function restoreState<Row, Sort extends string, Filter extends string, View extends string>(
  definition: CollectionDefinition<Row, Sort, Filter, View>,
  stored: Json,
): CollectionQuery<Sort, Filter, View> | null {
  const version = stored.v === undefined ? definition.stateVersion : stored.v;
  if (typeof version !== "number" || !Number.isInteger(version)) return null;
  if (version === definition.stateVersion) return sanitizeState(definition, stored);

  const migrated = definition.migrate?.(stored, version);
  return migrated ? sanitizeState(definition, migrated) : null;
}

/**
 * The query a stored text stands for: null when it is missing, corrupt or of a version the
 * definition cannot migrate (the caller then uses the defaults), otherwise the validated query.
 */
export function decodeState<Row, Sort extends string, Filter extends string, View extends string>(
  definition: CollectionDefinition<Row, Sort, Filter, View>,
  raw: unknown,
): CollectionQuery<Sort, Filter, View> | null {
  if (typeof raw !== "string" || raw === "" || raw.length > MAX_ENCODED) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(raw));
  } catch {
    return null;
  }
  return isRecord(parsed) ? restoreState(definition, parsed) : null;
}

/** A stable text of a query: the cache key of a page, and a cheap equality. */
export function queryKey(query: CollectionQuery): string {
  return JSON.stringify([
    query.page,
    query.pageSize,
    query.sort,
    query.direction,
    query.search,
    query.view,
    Object.entries(query.filters).sort(([a], [b]) => a.localeCompare(b)),
  ]);
}
