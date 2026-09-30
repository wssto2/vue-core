import type { RouteLocationRaw } from "vue-router";
import type { PageBack } from "../page";

/** The records next to the open one in the list it was opened from. */
export interface RecordNeighbors {
  /** The open record's place in the list, from 1. */
  readonly position: number;
  readonly total: number;
  /** Where the previous and the next record are; null at the ends. */
  readonly previous: RouteLocationRaw | null;
  readonly next: RouteLocationRaw | null;
}

/**
 * What a record knows about the list it was opened from, so `ResourcePage` can lead back to it with
 * its state and page through its records. A collection supplies it; a record opened by a direct link has
 * none, and the page then has no list to go back to and no pager. `ResourcePage` depends on this
 * interface only, never on collection code.
 *
 * Its members are read while the page renders, so they may be getters over reactive state.
 */
export interface RecordListContext {
  /** The list with its state: where "back" leads. */
  readonly back: PageBack;
  /** Null when the neighbors are not known (yet). */
  readonly neighbors: RecordNeighbors | null;
}
