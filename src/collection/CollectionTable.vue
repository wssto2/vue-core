<script setup lang="ts" generic="Row extends object, Col extends Column<Row>">
import { computed, ref, useSlots, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import Button from "../button/Button.vue";
import { Tabs } from "../controls";
import { useFormat } from "../format";
import { Icon } from "../icon";
import { Banner, EmptyState } from "../state";
import CollectionEmptyResult from "./CollectionEmptyResult.vue";
import CollectionPager from "./CollectionPager.vue";
import CollectionRows from "./CollectionRows.vue";
import CollectionToolbar from "./CollectionToolbar.vue";
import type { Column, RowAction } from "./columns";
import { filterChips, type FilterChip } from "./filters";
import { useRowLayout } from "./rowLayout";
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
 *     <template #leading="{ item }"><IconTile weight="soft" size="sm" :icon="iconOf(item)" /></template>
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
// Every slot the page was given but the toolbar goes to the rows as it is, so the typed scopes stay the table's.
const forwarded = computed(() => Object.keys(useSlots()).filter((name) => name !== "toolbar" && name !== "empty"));

// --- columns and rows ---------------------------------------------------------------------

const columns = computed(() => props.collection.columns.value as readonly Col[]);
const { narrow, phone: showRows } = useRowLayout(() => columns.value);
const rows = computed(() => props.collection.rows.value);
const link = (item: Row) => props.collection.recordLocation(item);

// The search text marks where it matched in an identity cell.
const search = computed(() => props.collection.query.value.search);

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
  return activeChips.value[activeChips.value.length - 1] ?? null;
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

const sorted = computed(() => {
  const { sort, direction } = props.collection.query.value;
  return sort === null ? null : { key: sort, direction };
});

// Phones: changing page brings the list's top back into view, otherwise the next page starts wherever the thumb was.
const card = useTemplateRef<HTMLElement>("card");
const scrollToTop = () => card.value?.scrollIntoView?.({ block: "start", behavior: "smooth" });

const loading = computed(() => props.collection.display.value === "loading");
const skeletonRows = computed(() => props.collection.query.value.pageSize);

const refreshing = computed(() => props.collection.state.value.status === "refreshing");
const stale = computed(() => props.collection.state.value.status === "stale");
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

      <CollectionRows :columns="columns" :rows="rows" :row-key="props.collection.rowKey" :display="props.collection.display.value" :phone="showRows" :link="link" :search="search"
        :sorted="sorted" :row-actions="props.rowActions" :row-label="props.rowLabel" :row-height="props.rowHeight" :density="props.density" :actions-visible="props.actionsVisible"
        :skeleton-rows="skeletonRows" :reserve-rows="loading ? skeletonRows : undefined" @sort="(key) => props.collection.toggleSort(key)">
        <template v-for="name in forwarded" :key="name" #[name]="scope">
          <!-- @vue-ignore -->
          <slot :name="name" v-bind="(scope as Record<string, unknown> | undefined) ?? {}" />
        </template>
        <template #failed>
          <Banner tone="warning" role="alert">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div><p class="font-semibold">{{ t("core.collection.failed.title") }}</p><p>{{ message }}</p></div>
              <Button prominence="secondary" size="sm" @click="props.collection.refresh()">{{ t("core.actions.retry") }}</Button>
            </div>
          </Banner>
        </template>
        <template #empty>
          <slot v-if="props.collection.display.value === 'empty' && slots.empty" name="empty" />
          <CollectionEmptyResult v-else-if="props.collection.display.value !== 'empty' && activeChips.length > 0" :chips="activeChips" :last-chip="lastChip" @remove="removeChip" @clear-all="clearAll" />
          <EmptyState v-else :title="t('core.collection.no_data')" :description="t('core.collection.no_results')" />
        </template>
      </CollectionRows>

      <CollectionPager :collection="props.collection" :compact="narrow" :flat="showRows" @turned="scrollToTop" />
    </div>
  </div>
</template>
