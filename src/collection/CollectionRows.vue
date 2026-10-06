<script setup lang="ts" generic="Row extends object, Col extends Column<Row>">
import { computed, useSlots, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { RouterLink, type RouteLocationRaw } from "vue-router";
import { SwipeActions } from "../controls";
import { Icon } from "../icon";
import { Menu, Tooltip } from "../overlay";
import { EmptyState } from "../state";
import CollectionCell from "./CollectionCell.vue";
import { valueAt, type Column, type ColumnKey, type RowAction } from "./columns";
import { useRowInteractions } from "./rowInteractions";
import type { CollectionSlots } from "./slots";
import type { CollectionDisplay } from "./useCollection";
import type { SortDirection } from "./types";

/**
 * The rows of a list, as `CollectionTable` and `DataTable` show them: a table with quiet column
 * labels, or (`phone`) an inset list of phone rows built from the same columns, with the row
 * behaviours (click opens the record, swipe and long press or right click list the row's actions),
 * the loading skeleton, and the actions column. It knows nothing of where the rows came from: the
 * collection's toolbar, pager, banners and filters stay with `CollectionTable`. Internal.
 */
const props = withDefaults(defineProps<{
  columns: readonly Col[];
  rows: readonly Row[];
  rowKey: (row: Row) => string | number;
  display: CollectionDisplay;
  /** Phone rows instead of a table (see `useRowLayout`). */
  phone: boolean;
  /** Where a click on the row goes; null for a row that is not a link. */
  link: (row: Row) => RouteLocationRaw | null;
  /** Text to mark in an identity cell. */
  search?: string;
  /** The sort the header shows; a header sorts (`sort`) only when the column has a `sort` key. */
  sorted?: { key: string; direction: SortDirection } | null;
  rowActions?: (row: Row) => RowAction[];
  rowLabel?: (row: Row) => string;
  /** Pixels. */
  rowHeight?: number;
  density?: "regular" | "condensed";
  actionsVisible?: boolean;
  skeletonRows: number;
  /** Rows to reserve the height of while loading, so the card does not jump when they land. */
  reserveRows?: number;
  rowClass?: (row: Row) => string | undefined;
}>(), {
  search: undefined,
  sorted: null,
  rowActions: undefined,
  rowLabel: undefined,
  rowHeight: undefined,
  density: "regular",
  actionsVisible: false,
  reserveRows: undefined,
  rowClass: undefined,
});

const emit = defineEmits<{ sort: [key: string] }>();

const slots = defineSlots<CollectionSlots<Row, Col> & {
  /** What a failed load shows. */
  failed?: () => unknown;
}>();

const { t } = useI18n();
const allSlots = useSlots() as Record<string, unknown>;

const withRole = (role: NonNullable<Column<Row>["mobile"]>) => props.columns.filter((column) => column.mobile === role);
const primary = computed(() => withRole("primary"));
const accessory = computed(() => withRole("accessory"));
const meta = computed(() => withRole("meta"));
// A lone standard identity in the first line shares the line with the accessory only through its title: the subtitle
// runs under both, on the full width (and cannot inherit the title's weight).
const spreadIdentity = computed(() => primary.value.length === 1 && primary.value[0]!.kind === "identity" && !hasSlot(primary.value[0]!));
const hasAccessory = (item: Row) => accessory.value.length > 0 || (moreInColumn.value && hasActions(item));

const slotName = (column: Column<Row>) => `cell-${String(column.key).replace(/\./g, "_")}`;
const hasSlot = (column: Column<Row>) => !!allSlots[slotName(column)];
const cellValue = (item: Row, column: Column<Row>) => valueAt(item, column.key as ColumnKey<Row>);
const isBlank = (value: unknown) => value === null || value === undefined || value === "";

// Literal class names, so Tailwind generates them.
const HIDE_BELOW = { md: "hidden md:table-cell", xl: "hidden xl:table-cell", "2xl": "hidden 2xl:table-cell" } as const;
const visibility = (column: Column<Row>) => (column.hideBelow ? [HIDE_BELOW[column.hideBelow]] : []);
const headerClass = (column: Column<Row>) => ["text-nowrap px-4 pt-2.5 pb-2 text-footnote font-normal text-content-muted", ...visibility(column)];
const ALIGN = { start: "text-left", center: "text-center", end: "text-right" } as const;
const cellClass = (column: Column<Row>) => [...visibility(column), ALIGN[column.align ?? "start"]];
const JUSTIFY = { start: "justify-start", center: "justify-center", end: "justify-end" } as const;

// --- rows and their actions ---------------------------------------------------------------

const hasRecordLinks = computed(() => props.rows.length > 0 && props.link(props.rows[0] as Row) !== null);

const rowMenu = useTemplateRef<InstanceType<typeof Menu>>("rowMenu");
const interactions = useRowInteractions<Row>({
  actions: () => props.rowActions,
  label: () => props.rowLabel,
  target: (row) => props.link(row),
  presentMenu: (x, y) => rowMenu.value?.presentAt(x, y),
  moreLabel: () => t("core.page.more_actions"),
});

// A list whose row actions are real commands shows a visible More button (in the actions column
// and on the phone row), unless the record's link or a custom actions cell already stands there.
const moreInColumn = computed(() => !!props.rowActions && (props.actionsVisible || (!slots.actions && !hasRecordLinks.value)));
const hasActionsColumn = computed(() => !!slots.actions || hasRecordLinks.value || moreInColumn.value);
const moreLabel = (item: Row) => (props.rowLabel ? `${t("core.page.more_actions")}: ${props.rowLabel(item)}` : t("core.page.more_actions"));
const hasActions = (item: Row) => interactions.actionsOf(item).length > 0;
const colspan = computed(() => props.columns.length + (hasActionsColumn.value ? 1 : 0));

// --- sorting ---------------------------------------------------------------------------------

const isSorted = (column: Column<Row>) => column.sort !== undefined && props.sorted?.key === column.sort;
const ariaSort = (column: Column<Row>): "ascending" | "descending" | "none" | undefined =>
  column.sort === undefined ? undefined : !isSorted(column) ? "none" : props.sorted?.direction === "asc" ? "ascending" : "descending";
const sortIcon = (column: Column<Row>) => (!isSorted(column) ? "expandUpDownLine" : props.sorted?.direction === "asc" ? "arrowUpSLine" : "arrowDownSLine");

/** Rows land after the skeleton one after another: 30 ms apart, the ninth on together. */
const rowIn = (index: number) => ({ animationDelay: `${Math.min(index, 8) * 30}ms` });

const loading = computed(() => props.display === "loading");
const HEADER_HEIGHT = 37;
const minHeight = computed(() => (loading.value && props.reserveRows !== undefined ? `${props.reserveRows * (props.rowHeight ?? 40) + HEADER_HEIGHT}px` : undefined));
const showEmpty = computed(() => props.display === "empty" || props.display === "no-matches");
</script>

<template>
  <!-- Phone rows (below 1024 px): an inset grouped list with separators that start at the text. -->
  <ul v-if="props.phone" class="overflow-hidden rounded-group bg-surface-cell shadow-group" data-test="collection-mobile-rows">
    <template v-if="loading">
      <li v-for="row in props.skeletonRows" :key="`skeleton-${row}`" aria-hidden="true"
        class="relative flex animate-pulse items-start gap-3 px-row-inset py-3 motion-reduce:animate-none not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:left-row-inset not-first:before:h-px not-first:before:bg-border-separator"
        :style="{ animationDelay: `${row * 60}ms` }">
        <span class="size-9 shrink-0 rounded-full bg-fill"></span>
        <span class="flex flex-1 flex-col gap-2 pt-1">
          <span class="h-2.5 rounded-full bg-fill-strong" :style="{ width: `${45 + ((row * 13) % 30)}%` }"></span>
          <span class="h-2 rounded-full bg-fill" :style="{ width: `${60 + ((row * 7) % 25)}%` }"></span>
        </span>
      </li>
    </template>

    <template v-if="props.display === 'rows'">
      <li v-for="(item, index) in props.rows" :key="props.rowKey(item)" :style="rowIn(index)" data-test="collection-row"
        class="relative animate-row-in transition-colors duration-motion-fast active:bg-fill not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:left-row-inset not-first:before:z-10 not-first:before:h-px not-first:before:bg-border-separator"
        :class="[props.link(item) ? 'cursor-pointer' : undefined, props.rowClass?.(item)]"
        @click.capture="interactions.onClickCapture" @click="interactions.onClick($event, item)" @contextmenu="interactions.onContextMenu($event, item)"
        @pointerdown="interactions.onPointerDown($event, item)" @pointermove="interactions.onPointerMove" @pointerup="interactions.cancelPress" @pointercancel="interactions.cancelPress">
        <SwipeActions :actions="interactions.swipeActions(item)" content-class="px-row-inset py-2.5">
          <div class="flex items-start gap-3">
            <div v-if="slots.leading" class="shrink-0 pt-0.5">
              <slot name="leading" :item="item" :compact="true" />
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <div class="grid min-w-0 items-start gap-x-3" :class="hasAccessory(item) ? 'grid-cols-[minmax(0,1fr)_auto]' : 'grid-cols-[minmax(0,1fr)]'" data-test="collection-row-head">
                <div :class="spreadIdentity ? 'contents' : 'col-start-1 row-start-1 min-w-0'">
                  <!-- A provided cell slot renders as is, even empty (a meta that has nothing to say); a column without one shows its standard cell. -->
                  <template v-for="column in primary" :key="String(column.key)">
                    <!-- @vue-ignore -->
                    <slot v-if="hasSlot(column)" :name="slotName(column)" :item="item" :value="cellValue(item, column)" :compact="true" :to="props.link(item)" :search="props.search" />
                    <CollectionCell v-else-if="spreadIdentity" :column="column" :item="item" :compact="true" :to="props.link(item)" :search="props.search" spread />
                    <span v-else class="block truncate text-row-title"><CollectionCell :column="column" :item="item" :compact="true" :to="props.link(item)" :search="props.search" /></span>
                  </template>
                </div>
                <div v-if="hasAccessory(item)" class="col-start-2 row-start-1 flex shrink-0 items-center gap-2 pt-0.5">
                  <template v-for="column in accessory" :key="String(column.key)">
                    <!-- @vue-ignore -->
                    <slot v-if="hasSlot(column)" :name="slotName(column)" :item="item" :value="cellValue(item, column)" :compact="true" :to="props.link(item)" :search="props.search" />
                    <CollectionCell v-else :column="column" :item="item" :compact="true" :to="props.link(item)" :search="props.search" />
                  </template>
                  <button v-if="moreInColumn && hasActions(item)" type="button" data-test="collection-row-more" :aria-label="moreLabel(item)"
                    class="hit-target -my-1 -mr-1 flex size-8 cursor-pointer items-center justify-center rounded-full text-content-muted active:bg-fill"
                    @click.stop="interactions.openMenuFrom($event, item)">
                    <Icon name="moreLine" :size="20" />
                  </button>
                </div>
              </div>
              <div v-if="meta.length" class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-row-meta">
                <template v-for="column in meta" :key="String(column.key)">
                  <!-- @vue-ignore -->
                  <slot v-if="hasSlot(column)" :name="slotName(column)" :item="item" :value="cellValue(item, column)" :compact="true" :to="props.link(item)" :search="props.search" />
                  <span v-else-if="!isBlank(cellValue(item, column))" class="truncate"><CollectionCell :column="column" :item="item" :compact="true" :to="props.link(item)" :search="props.search" /></span>
                </template>
              </div>
            </div>
          </div>
        </SwipeActions>
      </li>
    </template>

    <li v-if="props.display === 'failed'" class="px-4 py-6" data-test="collection-failed">
      <slot name="failed" />
    </li>

    <li v-if="showEmpty" class="px-4 py-2 text-center" data-test="collection-empty">
      <slot name="empty">
        <EmptyState :title="t('core.collection.no_data')" />
      </slot>
    </li>
  </ul>

  <div v-else class="inline-block w-full align-middle">
    <div class="overflow-x-auto" :style="{ minHeight }">
      <table class="collection-grid w-full" :class="{ condensed: props.density === 'condensed' }">
        <thead class="border-b border-border-separator">
          <tr>
            <th v-for="column in props.columns" :key="String(column.key)" scope="col" :class="headerClass(column)" :style="{ width: column.width ? `${column.width}px` : undefined, textAlign: column.align ?? 'start' }" :aria-sort="ariaSort(column)">
              <!-- Header content lines up with the cells below it. The sort arrow shows on hover and on the sorted column only. -->
              <div class="flex" :class="JUSTIFY[column.align ?? 'start']">
                <button v-if="column.sort !== undefined" type="button" class="group inline-flex cursor-pointer items-center gap-1 rounded-sm transition-colors hover:text-content-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                  :class="[isSorted(column) ? 'font-semibold text-content-strong' : '', column.align === 'end' ? 'flex-row-reverse' : '']"
                  @click="emit('sort', column.sort)">
                  <span>{{ column.label }}</span>
                  <Icon :name="sortIcon(column)" :size="14"
                    :class="isSorted(column) ? 'text-content-muted' : 'text-content-disabled opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100'" />
                </button>
                <span v-else>{{ column.label }}</span>
              </div>
            </th>
            <th v-if="hasActionsColumn" class="px-4 pt-2.5 pb-2" style="width: 20px"><span class="sr-only">{{ t("core.actions.more") }}</span></th>
          </tr>
        </thead>

        <tbody>
          <!-- Shaped like the cells they stand in for (a mark and two lines of uneven length), so the list does not jump when rows land. -->
          <template v-if="loading">
            <tr v-for="row in props.skeletonRows" :key="`skeleton-${row}`" aria-hidden="true" :style="props.rowHeight ? { height: `${props.rowHeight}px` } : undefined">
              <td v-for="(column, columnIndex) in props.columns" :key="String(column.key)" :class="visibility(column)">
                <div class="flex animate-pulse items-center gap-3 motion-reduce:animate-none" :style="{ animationDelay: `${row * 60}ms` }">
                  <span v-if="columnIndex === 0" class="size-8 shrink-0 rounded-full bg-fill"></span>
                  <span class="flex flex-1 flex-col gap-1.5">
                    <span class="h-2.5 rounded-full bg-fill-strong" :style="{ width: `${55 + ((row * 7 + columnIndex * 13) % 35)}%` }"></span>
                    <span class="h-2 rounded-full bg-fill" :style="{ width: `${30 + ((row * 11 + columnIndex * 5) % 30)}%` }"></span>
                  </span>
                </div>
              </td>
              <td v-if="hasActionsColumn"><div class="mx-auto h-6 w-6 animate-pulse rounded-full bg-fill motion-reduce:animate-none"></div></td>
            </tr>
          </template>

          <template v-if="props.display === 'rows'">
            <tr v-for="(item, index) in props.rows" :key="props.rowKey(item)" class="animate-row-in" data-test="collection-row"
              :class="[props.link(item) ? 'cursor-pointer' : undefined, props.rowClass?.(item)]" :style="[props.rowHeight ? { height: `${props.rowHeight}px` } : {}, rowIn(index)]"
              @click.capture="interactions.onClickCapture" @click="interactions.onClick($event, item)" @contextmenu="interactions.onContextMenu($event, item)"
              @pointerdown="interactions.onPointerDown($event, item)">
              <td v-for="(column, columnIndex) in props.columns" :key="String(column.key)" :class="cellClass(column)">
                <!-- @vue-ignore -->
                <slot :name="slotName(column)" :item="item" :value="cellValue(item, column)" :compact="false" :to="props.link(item)">
                  <CollectionCell :column="column" :item="item" :compact="false" :to="props.link(item)" :search="props.search">
                    <template v-if="slots.leading && columnIndex === 0" #leading><slot name="leading" :item="item" :compact="false" /></template>
                  </CollectionCell>
                </slot>
              </td>

              <td v-if="hasActionsColumn">
                <slot name="actions" :item="item">
                  <div class="flex items-center justify-center gap-1">
                    <Tooltip v-if="props.link(item)" :text="t('core.collection.open_record')" side="left">
                      <RouterLink :to="props.link(item) as RouteLocationRaw" :aria-label="`${t('core.collection.open_record')}${props.rowLabel ? `: ${props.rowLabel(item)}` : ''}`"
                        class="inline-flex rounded-md p-1.5 text-content-link transition-colors hover:bg-tint-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus">
                        <Icon name="eye" :size="18" />
                      </RouterLink>
                    </Tooltip>
                    <button v-if="moreInColumn && hasActions(item)" type="button" data-test="collection-row-more" :aria-label="moreLabel(item)"
                      class="hit-target flex size-8 cursor-pointer items-center justify-center rounded-full bg-fill text-content-strong transition-colors duration-motion-fast hover:bg-fill-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                      @click.stop="interactions.openMenuFrom($event, item)">
                      <Icon name="moreLine" :size="18" />
                    </button>
                  </div>
                </slot>
              </td>
            </tr>
          </template>

          <tr v-if="props.display === 'failed'" data-test="collection-failed">
            <td :colspan="colspan" class="!whitespace-normal py-6"><slot name="failed" /></td>
          </tr>

          <tr v-if="showEmpty" data-test="collection-empty">
            <td :colspan="colspan" class="!whitespace-normal py-6 text-center">
              <slot name="empty">
                <EmptyState :title="t('core.collection.no_data')" />
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <Menu v-if="props.rowActions" ref="rowMenu" :items="interactions.menuItems.value" :label="interactions.menuLabel.value" />
</template>
