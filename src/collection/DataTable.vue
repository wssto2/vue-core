<script setup lang="ts" generic="Row extends object, const Col extends Column<Row, never>">
import { computed, useSlots } from "vue";
import type { RouteLocationRaw } from "vue-router";
import CollectionRows from "./CollectionRows.vue";
import type { Column, RowAction } from "./columns";
import { useRowLayout } from "./rowLayout";
import type { RowsSlots } from "./slots";

/**
 * A small table over an array you already have: a child list on a record page, a summary on a
 * dashboard, a few lines of a form. No fetching, paging, search or URL state; for a list that has
 * those, use `useCollection` and `CollectionTable`. The columns are the collection's columns (kinds,
 * `align`, `width`, `hideBelow`, `mobile` roles, typed `#cell-<key>` slots), the rows the same
 * table and phone rows, so the two look and behave alike. It has no card of its own: put it in one.
 *
 *   <DataTable :rows="orders" :columns="columns" :row-key="(order) => order.id">
 *     <template #cell-status="{ item }"><StatusBadge :status="item.status" /></template>
 *     <template #actions="{ item }"><RowActions :actions="orderActions(item)" /></template>
 *     <template #empty>No orders yet.</template>
 *   </DataTable>
 *
 * Write the columns with `satisfies TableColumns<Row>`. They cannot have a `sort` key: the table
 * shows the rows in the order it was given them.
 */
const props = withDefaults(defineProps<{
  rows: readonly Row[];
  columns: readonly Col[];
  rowKey: (row: Row) => string | number;
  /** Skeleton rows instead of the rows (and instead of the empty state). */
  loading?: boolean;
  /** How many skeleton rows `loading` shows. */
  skeletonRows?: number;
  /** Where a row's record lives: the row opens it on click, and an identity column links to it. */
  recordRoute?: (row: Row) => RouteLocationRaw;
  /** Quick actions per row: swiped in on phones (links), and the row's context menu (long press, right click). */
  rowActions?: (row: Row) => RowAction[];
  /** The accessible name of a row's menu and More button, e.g. the record's name. */
  rowLabel?: (row: Row) => string;
  /** Pixels. */
  rowHeight?: number;
  density?: "regular" | "condensed";
  /** The row's actions are the only way to perform them, so the More button shows in the row. */
  actionsVisible?: boolean;
  /** Extra classes for a row, e.g. to set apart a total or the newest row. */
  rowClass?: (row: Row) => string | undefined;
  /** A picker: a click or tap on the row calls `pick(row)`, the arrows and Enter do too (see `CollectionTable`); instead of `recordRoute`. */
  pick?: (row: Row) => void;
  pickLabel?: string;
}>(), {
  loading: false,
  skeletonRows: 3,
  recordRoute: undefined,
  rowActions: undefined,
  rowLabel: undefined,
  rowHeight: undefined,
  density: "regular",
  actionsVisible: false,
  rowClass: undefined,
  pick: undefined,
  pickLabel: undefined,
});

defineSlots<RowsSlots<Row, Col> & {
  /** What shows when there are no rows; "No data" by default. */
  empty?: () => unknown;
}>();

const { phone } = useRowLayout(() => props.columns);
const display = computed(() => (props.loading ? "loading" : props.rows.length === 0 ? "empty" : "rows"));
const link = (row: Row) => (props.recordRoute && !props.pick ? props.recordRoute(row) : null);

// Every slot the page was given goes to the rows as it is, so the typed scopes stay the table's.
const forwarded = computed(() => Object.keys(useSlots()));
</script>

<template>
  <div :aria-busy="props.loading || undefined" data-test="data-table">
    <CollectionRows :columns="props.columns" :rows="props.rows" :row-key="props.rowKey" :display="display" :phone="phone" :link="link" :row-actions="props.rowActions"
      :row-label="props.rowLabel" :row-height="props.rowHeight" :density="props.density" :actions-visible="props.actionsVisible" :skeleton-rows="props.skeletonRows"
      :row-class="props.rowClass" :pick="props.pick" :pick-label="props.pickLabel">
      <template v-for="name in forwarded" :key="name" #[name]="scope">
        <!-- @vue-ignore -->
        <slot :name="name" v-bind="(scope as Record<string, unknown> | undefined) ?? {}" />
      </template>
    </CollectionRows>
  </div>
</template>
