import { shallowRef, type MaybeRefOrGetter, type Ref } from "vue";
import type { RouteLocationRaw } from "vue-router";
import type { IconName } from "../icon";
import { perDocument } from "../internal/perDocument";
import type { Tone } from "../state";

/** One result the palette can open. */
export interface QuickSearchRow {
  /** Unique among the rows shown; a test hook too (`data-test="quick-search-row-<key>"`). */
  readonly key: string;
  readonly title: string;
  /** A second line (an identifier, a status text). */
  readonly meta?: string;
  /** Draws `meta` in a monospace face: a VIN, a plate. */
  readonly mono?: boolean;
  readonly icon: IconName;
  /** The icon tile: `neutral` (default), `accent` (the kind of record people look for most) or `action` (something to do, not a record). */
  readonly tile?: "neutral" | "accent" | "action";
  readonly badge?: { readonly label: string; readonly tone: Tone };
  readonly to: RouteLocationRaw;
}

/** Rows under one heading. */
export interface QuickSearchGroup {
  readonly key: string;
  /** The heading, in the app's language. */
  readonly label: string;
  readonly rows: readonly QuickSearchRow[];
}

/** What the server answered for one query. */
export interface QuickSearchAnswer {
  readonly groups: readonly QuickSearchGroup[];
  /** Names of the groups that could not be searched this time (already translated): the palette says some results are missing. */
  readonly unavailable?: readonly string[];
}

export interface QuickSearchOptions {
  /** Looks `query` up (trimmed, at least `minLength` characters). Latest query wins: `signal` is aborted when a newer one starts or the palette closes. */
  search: (query: string, signal: AbortSignal) => Promise<QuickSearchAnswer>;
  /** Groups the app derives from the query alone, shown under the results at once (a VIN's "enter this vehicle"). They never count as results: with only these, "nothing found" still shows. */
  suggest?: (query: string) => readonly QuickSearchGroup[];
  /** The rows to show before anything is typed (recently opened ones). Read each time the palette opens. */
  recent?: () => readonly QuickSearchRow[];
  /** A row was chosen: remember it as recent. */
  onChoose?: (row: QuickSearchRow) => void;
  /**
   * The field's placeholder ("Search a vehicle, VIN, customer…"). The three texts are read each time the palette renders, so an
   * application whose messages load lazily passes a getter that follows the language: `placeholder: () => t("search.placeholder")`.
   */
  placeholder?: MaybeRefOrGetter<string>;
  /** Shown before anything is typed and no recent rows exist: what can be searched. */
  hint?: MaybeRefOrGetter<string>;
  /** Shown under "Nothing for …": what the search covers. */
  noneHint?: MaybeRefOrGetter<string>;
  /** Characters before a search runs. Default 2. */
  minLength?: number;
  /** Milliseconds of quiet after typing before a search runs. Default 180. */
  delayMs?: number;
}

export interface QuickSearchControl {
  readonly isOpen: Readonly<Ref<boolean>>;
  open(): void;
  close(): void;
}

const OPEN = Symbol("vue-core:quick-search");

/**
 * Opens and closes the quick-search palette: for a trigger of your own (a phone top-bar button). The
 * state belongs to the document, like the dialog stack, so the button, the shortcut and the palette
 * share it wherever they are mounted.
 */
export function useQuickSearch(): QuickSearchControl {
  const isOpen = perDocument(OPEN, () => shallowRef(false));
  return { isOpen, open: () => (isOpen.value = true), close: () => (isOpen.value = false) };
}
