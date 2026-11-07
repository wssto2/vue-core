<script setup lang="ts" generic="Row extends ExplorerRow, const Col extends Column<Row, never>">
import { computed, inject, watch } from "vue";
import { useI18n } from "vue-i18n";
import { routerKey } from "vue-router";
import Button from "../button/Button.vue";
import IconTile from "../controls/IconTile.vue";
import type { IconName } from "../icon";
import type { PageAction } from "../page/types";
import EmptyState from "../state/EmptyState.vue";
import CollectionCell from "./CollectionCell.vue";
import { valueAt, type Column, type ColumnKey, type RowAction } from "./columns";
import type { ExplorerCrumb, ExplorerRow } from "./explorer";
import RowMore from "./RowMore.vue";
import type { CellSlots } from "./slots";

/**
 * Folders, pages, links and files in one card: a header with the host switch, the breadcrumb and the page's own buttons, a bar of
 * labelled actions that appears only while rows are ticked, and the rows. The app supplies the rows of the folder that is open and
 * its breadcrumb; the explorer owns what the user does with them: tick (`v-model:selected`, row ids), open (`@open`) and walk.
 *
 *   <FileExplorer v-model:selected="selected" v-model:folder="folder" :rows="rows" :columns="columns" :breadcrumb="crumbs" :label="t('pages')"
 *     :row-actions="rowActions" :selection-actions="batch" @open="edit">
 *     <template #switch><HostPicker v-model="host" /></template>
 *     <template #toolbar><Button @click="upload">{{ t("upload") }}</Button></template>
 *     <template #cell-edited="{ item }">{{ format.date(item.edited) }}</template>
 *   </FileExplorer>
 *
 * - **Walking.** A folder row, or a breadcrumb step, sets `v-model:folder` (the folder's id, `null` for the root) and, in an application
 *   with a router, the query parameter `param` (default `folder`): the folder is in the address, Back goes up, a link opens there.
 *   `param="null"` keeps it out of the URL. Ticks are cleared when the folder changes. A folder row never emits `open`; the other kinds do.
 * - **Selection.** The header box ticks every row (a partial selection shows the indeterminate mark). `selection-actions(rows)` builds the
 *   bar's buttons from the ticked rows, as the page's own `PageAction`s (a `critical` one is red); the bar and its "Clear selection" exist
 *   only while something is ticked.
 * - **Columns** are the collection's `TableColumns` (kinds, `align`, `width`, `hideBelow`, typed `#cell-<key>` slots); the name with
 *   its icon is always the first. `#icon` replaces a row's icon (a thumbnail for an image).
 */
const props = withDefaults(defineProps<{
  rows: readonly Row[];
  columns: readonly Col[];
  /** The accessible name of the table ("Pages and directories"). */
  label: string;
  /** Root first, the open folder last. Without it no breadcrumb shows. */
  breadcrumb?: readonly ExplorerCrumb[];
  loading?: boolean;
  /** The row's menu: More at its end. */
  rowActions?: (row: Row) => RowAction[];
  /** The bar of buttons over the ticked rows. */
  selectionActions?: (rows: readonly Row[]) => readonly PageAction[];
  /** The query parameter that holds the open folder; `null` keeps the folder out of the URL. */
  param?: string | null;
  /** The header of the name column. */
  nameLabel?: string;
}>(), { breadcrumb: () => [], loading: false, rowActions: undefined, selectionActions: undefined, param: "folder", nameLabel: undefined });

/** The ids of the ticked rows. */
const selected = defineModel<readonly (string | number)[]>("selected", { default: () => [] });
/** The id of the open folder, `null` at the root. */
const folder = defineModel<string | null>("folder", { default: null });
const emit = defineEmits<{ /** A page, link or file was activated (a click on its name, or on the row). */ open: [row: Row] }>();
defineSlots<CellSlots<Row, Col> & {
  /** Before the breadcrumb: the host picker. */
  switch?: () => unknown;
  /** The page's own buttons at the end of the header (upload, new folder, New). */
  toolbar?: () => unknown;
  /** A row's icon; by default the kind's. */
  icon?: (scope: { item: Row }) => unknown;
  /** What an empty folder shows. */
  empty?: () => unknown;
}>();

const { t } = useI18n();

// --- the folder, and the URL it lives in -------------------------------------------------------------------------------
const router = inject(routerKey, null);
const query = () => router?.currentRoute.value.query;
if (router && props.param !== null) {
  const read = () => {
    const value = query()?.[props.param as string];
    return typeof value === "string" && value !== "" ? value : null;
  };
  watch(read, (next) => {
    if (next !== folder.value) folder.value = next;
  }, { immediate: true });
}
function walk(id: string | null) {
  if (id === folder.value) return;
  if (!router || props.param === null) {
    folder.value = id;
    return;
  }
  const next = { ...query() };
  if (id === null) delete next[props.param];
  else next[props.param] = id;
  void router.push({ query: next }); // the watcher above moves `folder`
}
watch(folder, () => (selected.value = []));

// --- rows, ticks and the bar ---------------------------------------------------------------------------------------------
const chosen = computed(() => props.rows.filter((row) => selected.value.includes(row.id)));
const actions = computed(() => props.selectionActions?.(chosen.value) ?? []);
const everyRow = computed(() => props.rows.length > 0 && chosen.value.length === props.rows.length);
const toggle = (row: Row) => (selected.value = selected.value.includes(row.id) ? selected.value.filter((id) => id !== row.id) : [...selected.value, row.id]);
const toggleAll = () => (selected.value = everyRow.value ? [] : props.rows.map((row) => row.id));

function activate(row: Row) {
  if (row.kind === "folder") walk(String(row.id));
  else emit("open", row);
}
// A click on the row opens it, except on what has its own click (the box, a button, a link).
function onRow(event: MouseEvent, row: Row) {
  if ((event.target as HTMLElement).closest("a, button, input, label, [data-row-click-ignore]")) return;
  activate(row);
}

const ICONS: Record<ExplorerRow["kind"], { icon: IconName; tone: "brand" | "anchor" }> = {
  folder: { icon: "folderLine", tone: "brand" },
  page: { icon: "fileTextLine", tone: "anchor" },
  link: { icon: "externalLink", tone: "anchor" },
  file: { icon: "fileLine", tone: "anchor" },
};
const slotName = (column: Column<Row, never>) => `cell-${String(column.key).replace(/\./g, "_")}`;
const HIDE_BELOW = { md: "hidden md:table-cell", xl: "hidden xl:table-cell", "2xl": "hidden 2xl:table-cell" } as const;
const ALIGN = { start: "text-left", center: "text-center", end: "text-right" } as const;
const cellClass = (column: Column<Row, never>) => [column.hideBelow ? HIDE_BELOW[column.hideBelow] : "", ALIGN[column.align ?? "start"], "px-4"];
const CHECK = "size-4 cursor-pointer accent-tile-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";
</script>

<template>
  <section class="overflow-hidden rounded-group bg-surface-cell shadow-group" data-test="file-explorer" :aria-busy="props.loading || undefined">
    <header class="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      <slot name="switch" />
      <nav v-if="props.breadcrumb.length > 0" :aria-label="t('core.explorer.breadcrumb')" class="min-w-0">
        <ol class="flex flex-wrap items-center gap-1 text-body text-content-muted">
          <li v-for="(crumb, index) in props.breadcrumb" :key="crumb.id ?? 'root'" class="flex items-center gap-1">
            <span v-if="index > 0" aria-hidden="true">/</span>
            <span v-if="index === props.breadcrumb.length - 1" aria-current="page" class="text-content-strong">{{ crumb.label }}</span>
            <button v-else type="button" class="cursor-pointer rounded-sm hover:text-content-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus" @click="walk(crumb.id)">{{ crumb.label }}</button>
          </li>
        </ol>
      </nav>
      <div class="ml-auto flex flex-wrap items-center gap-2"><slot name="toolbar" /></div>
    </header>

    <div v-if="chosen.length > 0" role="region" :aria-label="t('core.explorer.selection')" data-test="selection-bar"
      class="flex flex-wrap items-center gap-2 border-y border-border-separator bg-tint-soft px-3 py-2">
      <span role="status" class="mr-1 text-body">{{ t("core.explorer.selected", chosen.length) }}</span>
      <Button v-for="action in actions" :key="action.id" size="sm" :icon="action.icon" :tone="action.tone" :disabled="action.disabled" :processing="action.processing" :data-page-action="action.id" @click="action.onClick()">{{ action.label }}</Button>
      <Button class="ml-auto" size="sm" prominence="link" data-test="selection-clear" @click="selected = []">{{ t("core.explorer.clear") }}</Button>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full" :aria-label="props.label">
        <thead class="border-y border-border-separator bg-fill/40 text-footnote font-normal text-content-muted">
          <tr class="text-left">
            <th scope="col" class="w-10 py-2 pl-4"><input type="checkbox" :class="CHECK" :aria-label="t('core.explorer.select_all')" :checked="everyRow" :indeterminate="chosen.length > 0 && !everyRow" :disabled="props.rows.length === 0" @change="toggleAll" /></th>
            <th scope="col" class="px-2 py-2 font-normal">{{ props.nameLabel ?? t("core.explorer.name") }}</th>
            <th v-for="column in props.columns" :key="String(column.key)" scope="col" class="py-2 font-normal" :class="cellClass(column)" :style="{ width: column.width ? `${column.width}px` : undefined }">{{ column.label }}</th>
            <th scope="col" class="w-12"><span class="sr-only">{{ t("core.actions.more") }}</span></th>
          </tr>
        </thead>
        <tbody>
          <template v-if="props.loading">
            <tr v-for="n in 3" :key="n" aria-hidden="true" class="h-[50px]"><td :colspan="props.columns.length + 3" class="px-4"><div class="h-3 w-1/3 animate-pulse rounded-full bg-fill motion-reduce:animate-none"></div></td></tr>
          </template>
          <template v-else>
            <tr v-for="row in props.rows" :key="row.id" data-test="explorer-row" :data-kind="row.kind" :aria-selected="selected.includes(row.id)"
              class="h-[50px] cursor-pointer border-b border-border-separator last:border-b-0 hover:bg-fill/50" :class="selected.includes(row.id) ? 'bg-tint-soft' : ''" @click="onRow($event, row)">
              <td class="py-1 pl-4"><input type="checkbox" :class="CHECK" :aria-label="t('core.explorer.select', { name: row.name })" :checked="selected.includes(row.id)" @change="toggle(row)" /></td>
              <td class="px-2 py-1">
                <button type="button" class="flex min-w-0 cursor-pointer items-center gap-3 rounded-sm text-left text-body text-content-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus" @click="activate(row)">
                  <slot name="icon" :item="row"><IconTile size="sm" :tone="ICONS[row.kind].tone" :icon="ICONS[row.kind].icon" /></slot>
                  <span class="truncate">{{ row.name }}</span>
                  <span v-if="row.kind === 'folder'" class="sr-only">{{ t("core.explorer.folder") }}</span>
                </button>
              </td>
              <td v-for="column in props.columns" :key="String(column.key)" :class="cellClass(column)">
                <!-- @vue-ignore -->
                <slot :name="slotName(column)" :item="row" :value="valueAt(row, column.key as ColumnKey<Row>)" :compact="false" :to="null">
                  <CollectionCell :column="column" :item="row" :compact="false" :to="null" />
                </slot>
              </td>
              <td class="pr-2"><RowMore :actions="props.rowActions?.(row) ?? []" :label="row.name" /></td>
            </tr>
            <tr v-if="props.rows.length === 0" data-test="explorer-empty"><td :colspan="props.columns.length + 3" class="py-6 text-center"><slot name="empty"><EmptyState :title="t('core.explorer.empty')" /></slot></td></tr>
          </template>
        </tbody>
      </table>
    </div>
  </section>
</template>
