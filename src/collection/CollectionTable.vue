<script setup lang="ts" generic="Row extends object, Col extends Column<Row>">
import { computed, ref, useSlots, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { RouterLink, type RouteLocationRaw } from "vue-router";
import Button from "../button/Button.vue";
import { SwipeActions, Tabs } from "../controls";
import { useFormat } from "../format";
import { Icon } from "../icon";
import { useMediaQuery } from "../internal/mediaQuery";
import { Menu, Tooltip } from "../overlay";
import { Banner, EmptyState } from "../state";
import CollectionCell from "./CollectionCell.vue";
import CollectionEmptyResult from "./CollectionEmptyResult.vue";
import CollectionPager from "./CollectionPager.vue";
import CollectionToolbar from "./CollectionToolbar.vue";
import { valueAt, type Column, type ColumnKey, type RowAction } from "./columns";
import { filterChips, type FilterChip } from "./filters";
import { useRowInteractions } from "./rowInteractions";
import type { CollectionSlots } from "./slots";
import type { Collection } from "./useCollection";

/**
 * A list as a grouped card: toolbar, rows, pager. On desktop a table with quiet column labels; below
 * 1024 px, when any column has a `mobile` role, an inset list of phone rows built from the same
 * columns. The page owns the columns, cells, filters, actions and permissions; this owns the
 * presentation: search and filters, loading skeletons, the failed / empty / no-matches states, the
 * refresh indicator, sorting, paging, and the row behaviours (click opens the record, swipe and
 * long press or right click list the row's actions).
 *
 *   <CollectionTable :collection="customers" :row-actions="rowActions" :row-label="customerName">
 *     <template #leading="{ item }"><IconTile :icon="iconOf(item)" /></template>
 *     <template #cell-status="{ item }"><StatusBadge :status="item.status" /></template>
 *   </CollectionTable>
 */
const props = withDefaults(defineProps<{
  collection: Collection<Row, string, string, string, Col>;
  /** Quick actions per row: swiped in on phones (links), and the row's context menu (long press, right click). */
  rowActions?: (row: Row) => RowAction[];
  /** The accessible name of a row's menu and More button, e.g. the record's name. */
  rowLabel?: (row: Row) => string;
  /** Pixels; reserves the height of the rows while they load. */
  rowHeight?: number;
  density?: "regular" | "condensed";
  /** `scope`: the views are a scope bar over one list (segments with count pills wide, scrolling capsules on phones). */
  viewsPresentation?: "segmented" | "scope";
  /**
   * The row's actions are the only way to perform them (edit, delete on a CRUD list), so the More
   * button shows on desktop and phone. Leave it off for shortcuts the record's own page repeats, such
   * as a lead's contact actions: swipe and the context menu are enough there.
   */
  actionsVisible?: boolean;
}>(), {
  rowActions: undefined,
  rowLabel: undefined,
  rowHeight: undefined,
  density: "regular",
  viewsPresentation: "segmented",
  actionsVisible: false,
});

const slots = defineSlots<CollectionSlots<Row, Col>>();

const { t } = useI18n();
const format = useFormat();
const allSlots = useSlots() as Record<string, unknown>;

const narrow = useMediaQuery("(max-width: 1023px)");

// --- columns ----------------------------------------------------------------------------

const columns = computed(() => props.collection.columns.value as readonly Column<Row>[]);
const hasRoles = computed(() => columns.value.some((column) => column.mobile && column.mobile !== "hidden"));
const showRows = computed(() => narrow.value && hasRoles.value);
const withRole = (role: NonNullable<Column<Row>["mobile"]>) => columns.value.filter((column) => column.mobile === role);
const primary = computed(() => withRole("primary"));
const accessory = computed(() => withRole("accessory"));
const meta = computed(() => withRole("meta"));

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

const rows = computed(() => props.collection.rows.value);
const link = (item: Row) => props.collection.recordLocation(item);
const hasRecordLinks = computed(() => rows.value.length > 0 && link(rows.value[0] as Row) !== null);

const rowMenu = useTemplateRef<InstanceType<typeof Menu>>("rowMenu");
const interactions = useRowInteractions<Row>({
  actions: () => props.rowActions,
  label: () => props.rowLabel,
  target: link,
  presentMenu: (x, y) => rowMenu.value?.presentAt(x, y),
  moreLabel: () => t("core.page.more_actions"),
});

// A list whose row actions are real commands shows a visible More button (in the actions column
// and on the phone row), unless the record's link or a custom actions cell already stands there.
const moreInColumn = computed(() => !!props.rowActions && (props.actionsVisible || (!slots.actions && !hasRecordLinks.value)));
const hasActionsColumn = computed(() => !!slots.actions || hasRecordLinks.value || moreInColumn.value);
const moreLabel = (item: Row) => (props.rowLabel ? `${t("core.page.more_actions")}: ${props.rowLabel(item)}` : t("core.page.more_actions"));
const hasActions = (item: Row) => interactions.actionsOf(item).length > 0;

// --- views -------------------------------------------------------------------------------

const tabs = computed(() => props.collection.views.value.map((view) => ({ value: view.key, label: view.label, icon: view.icon, badge: view.count })));

// --- filters, for the empty result ----------------------------------------------------------

const SEARCH_CHIP = "__search";
const touched = ref<string[]>([]);
const touch = (keys: string[]) => (touched.value = [...touched.value.filter((key) => !keys.includes(key)), ...keys]);

const activeChips = computed<FilterChip[]>(() => {
  const chips = filterChips(props.collection.filters.value, props.collection.query.value.filters, {
    formatNumber: (value) => format.number(value),
    from: t("core.collection.filters.range_from"),
    until: t("core.collection.filters.range_until"),
  });
  const search = props.collection.query.value.search;
  if (search) chips.push({ key: SEARCH_CHIP, label: t("core.collection.empty.search"), values: [search], clears: [] });
  return chips;
});

/** The chip "remove last" removes: the one changed most recently; state restored from the URL has no history, so the last listed. */
const lastChip = computed<FilterChip | null>(() => {
  for (const key of [...touched.value].reverse()) {
    const chip = activeChips.value.find((candidate) => candidate.key === key || candidate.clears.includes(key));
    if (chip) return chip;
  }
  return activeChips.value.at(-1) ?? null;
});

function removeChip(chip: FilterChip) {
  touched.value = touched.value.filter((key) => key !== chip.key && !chip.clears.includes(key));
  if (chip.key === SEARCH_CHIP) props.collection.search("");
  else props.collection.setFilters(Object.fromEntries(chip.clears.map((key) => [key, null])));
}

function clearAll() {
  touched.value = [];
  props.collection.clearFilters();
}

// --- sorting and paging ---------------------------------------------------------------------

const sorted = (column: Column<Row>) => column.sort !== undefined && props.collection.query.value.sort === column.sort;
const ariaSort = (column: Column<Row>): "ascending" | "descending" | "none" | undefined =>
  column.sort === undefined ? undefined : !sorted(column) ? "none" : props.collection.query.value.direction === "asc" ? "ascending" : "descending";
const sortIcon = (column: Column<Row>) => (!sorted(column) ? "expandUpDownLine" : props.collection.query.value.direction === "asc" ? "arrowUpSLine" : "arrowDownSLine");

// Phones: changing page brings the list's top back into view, otherwise the next page starts wherever the thumb was.
const card = useTemplateRef<HTMLElement>("card");
const scrollToTop = () => card.value?.scrollIntoView?.({ block: "start", behavior: "smooth" });

/** Rows land after the skeleton one after another: 30 ms apart, the ninth on together. */
const rowIn = (index: number) => ({ animationDelay: `${Math.min(index, 8) * 30}ms` });

const loading = computed(() => props.collection.display.value === "loading");
const HEADER_HEIGHT = 37;
const minHeight = computed(() => (loading.value ? `${props.collection.query.value.pageSize * (props.rowHeight ?? 40) + HEADER_HEIGHT}px` : undefined));
const skeletonRows = computed(() => props.collection.query.value.pageSize);

const refreshing = computed(() => props.collection.state.value.status === "refreshing");
const stale = computed(() => props.collection.state.value.status === "stale");
const failed = computed(() => props.collection.state.value.status === "failed");
const message = computed(() => {
  const state = props.collection.state.value;
  return state.status === "failed" || state.status === "stale" ? (state.error ?? "") : "";
});
</script>

<template>
  <div class="collection" :aria-busy="loading || refreshing || undefined" data-test="collection">
    <div v-if="tabs.length > 0" class="mb-3 select-none">
      <Tabs :model-value="props.collection.query.value.view" :tabs="tabs" :presentation="props.viewsPresentation" :label="t('core.collection.views_label')"
        @update:model-value="(view) => props.collection.setView(view === null ? null : String(view))" />
    </div>

    <!-- Desktop: one grouped card holds the toolbar, the rows and the pager. Phone rows: the toolbar and pager sit on the canvas and the rows are an inset grouped list. -->
    <div ref="card" class="scroll-mt-16" :class="showRows ? '' : 'rounded-group bg-surface-cell shadow-group'">
      <CollectionToolbar :collection="props.collection" :narrow="narrow" :flat="showRows" @touched="touch">
        <slot name="toolbar" />
      </CollectionToolbar>

      <!-- A reload that keeps the previous rows, and one that failed and did not: said, never a silent stale list. -->
      <div v-if="refreshing" role="status" data-test="collection-refreshing"
        class="m-2 flex w-fit max-w-full items-center gap-2 rounded-group bg-fill py-1 pr-3 pl-3 text-footnote text-content-muted">
        <Icon name="loader4Line" :size="14" class="animate-spin motion-reduce:animate-none" />
        {{ t("core.state.refreshing") }}
      </div>
      <div v-if="stale" class="m-2" data-test="collection-stale">
        <Banner tone="warning" role="alert">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p>{{ message }}</p>
              <p>{{ t("core.state.stale") }}</p>
            </div>
            <Button prominence="secondary" size="sm" @click="props.collection.refresh()">{{ t("core.actions.retry") }}</Button>
          </div>
        </Banner>
      </div>

      <!-- Phone rows (below 1024 px): an inset grouped list with separators that start at the text. -->
      <ul v-if="showRows" class="overflow-hidden rounded-group bg-surface-cell shadow-group" data-test="collection-mobile-rows">
        <template v-if="loading">
          <li v-for="row in skeletonRows" :key="`skeleton-${row}`" aria-hidden="true"
            class="relative flex animate-pulse items-start gap-3 px-row-inset py-3 motion-reduce:animate-none not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:left-row-inset not-first:before:h-px not-first:before:bg-border-separator"
            :style="{ animationDelay: `${row * 60}ms` }">
            <span class="size-9 shrink-0 rounded-full bg-fill"></span>
            <span class="flex flex-1 flex-col gap-2 pt-1">
              <span class="h-2.5 rounded-full bg-fill-strong" :style="{ width: `${45 + ((row * 13) % 30)}%` }"></span>
              <span class="h-2 rounded-full bg-fill" :style="{ width: `${60 + ((row * 7) % 25)}%` }"></span>
            </span>
          </li>
        </template>

        <template v-if="props.collection.display.value === 'rows'">
          <li v-for="(item, index) in rows" :key="props.collection.rowKey(item)" :style="rowIn(index)" data-test="collection-row"
            class="relative animate-row-in transition-colors duration-motion-fast active:bg-fill not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:left-row-inset not-first:before:z-10 not-first:before:h-px not-first:before:bg-border-separator"
            :class="link(item) ? 'cursor-pointer' : undefined"
            @click.capture="interactions.onClickCapture" @click="interactions.onClick($event, item)" @contextmenu="interactions.onContextMenu($event, item)"
            @pointerdown="interactions.onPointerDown($event, item)" @pointermove="interactions.onPointerMove" @pointerup="interactions.cancelPress" @pointercancel="interactions.cancelPress">
            <SwipeActions :actions="interactions.swipeActions(item)" content-class="px-row-inset py-2.5">
              <div class="flex items-start gap-3">
                <div v-if="slots.leading" class="shrink-0 pt-0.5">
                  <slot name="leading" :item="item" :compact="true" />
                </div>
                <div class="flex min-w-0 flex-1 flex-col gap-1">
                  <div class="flex min-w-0 items-start gap-3">
                    <div class="min-w-0 flex-1">
                      <!-- A provided cell slot renders as is, even empty (a meta that has nothing to say); a column without one shows its standard cell. -->
                      <template v-for="column in primary" :key="String(column.key)">
                        <!-- @vue-ignore -->
                        <slot v-if="hasSlot(column)" :name="slotName(column)" :item="item" :value="cellValue(item, column)" :compact="true" :to="link(item)" />
                        <span v-else class="block truncate text-row-title"><CollectionCell :column="column" :item="item" :compact="true" :to="link(item)" /></span>
                      </template>
                    </div>
                    <div v-if="accessory.length || (moreInColumn && hasActions(item))" class="flex shrink-0 items-center gap-2 pt-0.5">
                      <template v-for="column in accessory" :key="String(column.key)">
                        <!-- @vue-ignore -->
                        <slot v-if="hasSlot(column)" :name="slotName(column)" :item="item" :value="cellValue(item, column)" :compact="true" :to="link(item)" />
                        <CollectionCell v-else :column="column" :item="item" :compact="true" :to="link(item)" />
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
                      <slot v-if="hasSlot(column)" :name="slotName(column)" :item="item" :value="cellValue(item, column)" :compact="true" :to="link(item)" />
                      <span v-else-if="!isBlank(cellValue(item, column))" class="truncate"><CollectionCell :column="column" :item="item" :compact="true" :to="link(item)" /></span>
                    </template>
                  </div>
                </div>
              </div>
            </SwipeActions>
          </li>
        </template>

        <li v-if="failed" class="px-4 py-6" data-test="collection-failed">
          <Banner tone="warning" role="alert">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div><p class="font-semibold">{{ t("core.collection.failed.title") }}</p><p>{{ message }}</p></div>
              <Button prominence="secondary" size="sm" @click="props.collection.refresh()">{{ t("core.actions.retry") }}</Button>
            </div>
          </Banner>
        </li>

        <li v-if="props.collection.display.value === 'empty' || props.collection.display.value === 'no-matches'" class="px-4 py-2 text-center" data-test="collection-empty">
          <slot v-if="props.collection.display.value === 'empty' && slots.empty" name="empty" />
          <CollectionEmptyResult v-else-if="activeChips.length > 0" :chips="activeChips" :last-chip="lastChip" @remove="removeChip" @clear-all="clearAll" />
          <EmptyState v-else :title="t('core.collection.no_data')" :description="t('core.collection.no_results')" />
        </li>
      </ul>

      <div v-else class="inline-block w-full align-middle">
        <div class="overflow-x-auto" :style="{ minHeight }">
          <table class="collection-grid w-full" :class="{ condensed: props.density === 'condensed' }">
            <thead class="border-b border-border-separator">
              <tr>
                <th v-for="column in columns" :key="String(column.key)" scope="col" :class="headerClass(column)" :style="{ width: column.width ? `${column.width}px` : undefined, textAlign: column.align ?? 'start' }" :aria-sort="ariaSort(column)">
                  <!-- Header content lines up with the cells below it. The sort arrow shows on hover and on the sorted column only. -->
                  <div class="flex" :class="JUSTIFY[column.align ?? 'start']">
                    <button v-if="column.sort !== undefined" type="button" class="group inline-flex cursor-pointer items-center gap-1 rounded-sm transition-colors hover:text-content-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                      :class="[sorted(column) ? 'font-semibold text-content-strong' : '', column.align === 'end' ? 'flex-row-reverse' : '']"
                      @click="props.collection.toggleSort(column.sort)">
                      <span>{{ column.label }}</span>
                      <Icon :name="sortIcon(column)" :size="14"
                        :class="sorted(column) ? 'text-content-muted' : 'text-content-disabled opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100'" />
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
                <tr v-for="row in skeletonRows" :key="`skeleton-${row}`" aria-hidden="true" :style="props.rowHeight ? { height: `${props.rowHeight}px` } : undefined">
                  <td v-for="(column, columnIndex) in columns" :key="String(column.key)" :class="visibility(column)">
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

              <template v-if="props.collection.display.value === 'rows'">
                <tr v-for="(item, index) in rows" :key="props.collection.rowKey(item)" class="animate-row-in" data-test="collection-row"
                  :class="link(item) ? 'cursor-pointer' : undefined" :style="[props.rowHeight ? { height: `${props.rowHeight}px` } : {}, rowIn(index)]"
                  @click.capture="interactions.onClickCapture" @click="interactions.onClick($event, item)" @contextmenu="interactions.onContextMenu($event, item)"
                  @pointerdown="interactions.onPointerDown($event, item)">
                  <td v-for="(column, columnIndex) in columns" :key="String(column.key)" :class="cellClass(column)">
                    <!-- @vue-ignore -->
                    <slot :name="slotName(column)" :item="item" :value="cellValue(item, column)" :compact="false" :to="link(item)">
                      <CollectionCell :column="column" :item="item" :compact="false" :to="link(item)">
                        <template v-if="slots.leading && columnIndex === 0" #leading><slot name="leading" :item="item" :compact="false" /></template>
                      </CollectionCell>
                    </slot>
                  </td>

                  <td v-if="hasActionsColumn">
                    <slot name="actions" :item="item">
                      <div class="flex items-center justify-center gap-1">
                        <Tooltip v-if="link(item)" :text="t('core.collection.open_record')" side="left">
                          <RouterLink :to="link(item) as RouteLocationRaw" :aria-label="`${t('core.collection.open_record')}${props.rowLabel ? `: ${props.rowLabel(item)}` : ''}`"
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

              <tr v-if="failed" data-test="collection-failed">
                <td :colspan="columns.length + (hasActionsColumn ? 1 : 0)" class="!whitespace-normal py-6">
                  <Banner tone="warning" role="alert">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <div><p class="font-semibold">{{ t("core.collection.failed.title") }}</p><p>{{ message }}</p></div>
                      <Button prominence="secondary" size="sm" @click="props.collection.refresh()">{{ t("core.actions.retry") }}</Button>
                    </div>
                  </Banner>
                </td>
              </tr>

              <tr v-if="props.collection.display.value === 'empty' || props.collection.display.value === 'no-matches'" data-test="collection-empty">
                <td :colspan="columns.length + (hasActionsColumn ? 1 : 0)" class="!whitespace-normal py-6 text-center">
                  <slot v-if="props.collection.display.value === 'empty' && slots.empty" name="empty" />
                  <CollectionEmptyResult v-else-if="activeChips.length > 0" :chips="activeChips" :last-chip="lastChip" @remove="removeChip" @clear-all="clearAll" />
                  <EmptyState v-else :title="t('core.collection.no_data')" :description="t('core.collection.no_results')" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <CollectionPager :collection="props.collection" :compact="narrow" :flat="showRows" @turned="scrollToTop" />
    </div>

    <Menu v-if="props.rowActions" ref="rowMenu" :items="interactions.menuItems.value" :label="interactions.menuLabel.value" />
  </div>
</template>
