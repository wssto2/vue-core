import type { RouteLocationRaw } from "vue-router";
import type { Column, ColumnValue, SlotKey } from "./columns";

/** What a `#cell-<key>` slot receives: one slot per column key, typed to the row and the column's value. */
export type CellSlots<Row, Col extends Column<Row>> = {
  [K in Col["key"] as `cell-${SlotKey<K>}`]?: (scope: {
    item: Row;
    value: ColumnValue<Row, K> | undefined;
    /** True in the phone row (the column's `mobile` roles), false in the table: render the compact form there. */
    compact: boolean;
    /** The record's link carrying the list's state (`?from=`); null without `recordRoute`. */
    to: RouteLocationRaw | null;
  }) => unknown;
};

/** Every slot of a collection table, and so of `ListPage`, which forwards them. */
export type CollectionSlots<Row, Col extends Column<Row>> = CellSlots<Row, Col> & {
  /** A mark that leads the record's identity (an avatar, a tile). Phone rows show it across both lines. */
  leading?: (scope: { item: Row; compact: boolean }) => unknown;
  /** Replaces the desktop actions cell (the link to the record and the More button). */
  actions?: (scope: { item: Row }) => unknown;
  /** Page controls in the toolbar, after the filters. */
  toolbar?: () => unknown;
  /** What an empty list shows when nothing exists yet (no search or filter applies): a first use that teaches. */
  empty?: () => unknown;
};
