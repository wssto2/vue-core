import type { RouteLocationRaw } from "vue-router";
import type { OpenChangeRow } from "./ext";

/** Where the Activity section sends a record the application knows: its name (an i18n key) and, when it has a page, the link. */
export interface ActivityRecord {
  /** The i18n key of the kind of record ("Lead"); shown instead of the server's `record_type`. */
  readonly labelKey: string;
  /** The page of the record with this id; without it the row names the record and does not link. */
  readonly to?: (id: number) => RouteLocationRaw;
}

/** A piece of a change's details: plain text, or text that links (a hand-over recipient, a binding). */
export type ChangeDetail = string | { readonly text: string; readonly to: RouteLocationRaw };

/** What the application says about one change in the Changes section; every part left out keeps the library's wording. */
export interface ChangeWords {
  /** The sentence ("Role granted"), already translated. */
  readonly sentence?: string;
  /** Details after the library's own ("Dealer: A to B"). */
  readonly details?: readonly ChangeDetail[];
}

/** `t` as `useI18n()` gives it. */
export type Translate = (key: string, named?: Record<string, unknown>) => string;

/**
 * The application's wording for a change: asked for every row (with its `ext`, as the server's change log wrote it); return
 * `undefined` for a row the library already words well. Used by `usersFeature({ changeWords })`.
 */
export type ChangeWordsFn = (row: OpenChangeRow, t: Translate) => ChangeWords | undefined;
