<script setup lang="ts" generic="Node extends TreeNode<Node>">
import { computed, provide, useSlots } from "vue";
import { useI18n } from "vue-i18n";
import { Icon } from "../icon";
import EmptyState from "../state/EmptyState.vue";
import type { RowAction } from "./columns";
import CollectionTreeBranch from "./CollectionTreeBranch.vue";
import { matchesText, treeContextKey, visibleNodes, type LooseNode, type TreeColumn, type TreeContext, type TreeNode, type TreeReorder } from "./tree";

/**
 * Rows in a tree: groups that open to show their items, as deep as the data goes. The app supplies the nodes (each with its `children`) and
 * answers what the user does; the tree owns how it looks and moves.
 *
 *   <CollectionTree v-model:expanded="open" :nodes="roots" :columns="columns" :label="t('characteristics')" reorderable
 *     active-label="Active" :add-label="(parent, level) => t(`add.${level}`)" :row-actions="actions"
 *     @reorder="move" @add="create" @toggle="switchOn" @open="edit">
 *     <template #cell-code="{ node }"><code>{{ node.code }}</code></template>
 *   </CollectionTree>
 *
 * - **Open and closed.** The chevron is a button with `aria-expanded`; `v-model:expanded` is the ids that are open. A closed group shows how
 *   many items it holds.
 * - **Order.** With `reorderable`, each group's children are a `SortableList` of their own: drag the handle, or Alt+↑ / Alt+↓, and `@reorder`
 *   says `{ id, parentId, index }` (the index among the parent's children, from 0). A row cannot leave its parent. The tree does not move
 *   rows itself: give it the nodes in their new order (at once, then confirm with the server). Reordering is off while a search or filter
 *   hides rows, because an index among some of the siblings would be wrong.
 * - **Columns** are `TreeColumn`s: a column with `visible(node, depth)` belongs to some rows only (the brand code, under Marke).
 *   `#cell-<key>` draws a cell; without it the node's `[key]` is shown. `active-label` adds the switch column over `node.active`; `@toggle`
 *   says `(node, active)`.
 * - **Adding.** `add-label(parent, level)` is the text of the add button of that level (`level` counts from 1) or `null` for none. A group
 *   with items shows it at the end of its items; one without (or closed) at the end of its row. `@add(parent)`; the roots' add (`parent` null)
 *   is the page's own button.
 * - **Search.** `search` (the app owns the field) and `filter` leave the rows that match and every ancestor of one, opened while it lasts.
 * - `readonly` takes away what changes the tree (handles, switches, add buttons) and keeps the rest.
 */
const props = withDefaults(defineProps<{
  nodes: readonly Node[];
  columns?: readonly TreeColumn<Node>[];
  /** The accessible name of the tree. */
  label: string;
  reorderable?: boolean;
  readonly?: boolean;
  search?: string;
  /** Rows to leave out, besides the search's. */
  filter?: (node: Node) => boolean;
  activeLabel?: string;
  addLabel?: (parent: Node | null, level: number) => string | null;
  rowActions?: (node: Node, depth: number) => RowAction[];
  /** The header of the name column. */
  nameLabel?: string;
}>(), { columns: () => [], reorderable: false, readonly: false, search: "", filter: undefined, activeLabel: undefined, addLabel: undefined, rowActions: undefined, nameLabel: undefined });

/** The ids of the open groups. */
const expanded = defineModel<readonly (string | number)[]>("expanded", { default: () => [] });
const emit = defineEmits<{
  /** A row was moved among its siblings. */
  reorder: [change: TreeReorder];
  /** The add button of `parent` (`null`: the roots) was pressed. */
  add: [parent: Node | null];
  /** The row's switch was flipped. */
  toggle: [node: Node, active: boolean];
  /** The row's name was pressed: open it. */
  open: [node: Node];
}>();
defineSlots<{
  /** A cell of the column called `<key>`. */
  [name: `cell-${string}`]: (scope: { node: Node; depth: number }) => unknown;
  /** A row's icon; by default a folder for a group and a tag for an item. */
  icon?: (scope: { node: Node; depth: number }) => unknown;
  /** What shows when there are no rows. */
  empty?: () => unknown;
}>();

const { t } = useI18n();
const slots = useSlots();

const filtering = computed(() => props.search.trim() !== "" || props.filter !== undefined);
const visible = computed(() => (filtering.value ? visibleNodes(props.nodes, (node) => (props.search.trim() === "" || matchesText(node.label, props.search)) && (props.filter?.(node) ?? true)) : null));
const shownCount = computed(() => (visible.value ? visible.value.shown.size : props.nodes.length));

const context: TreeContext = {
  get columns() { return props.columns as unknown as TreeContext["columns"]; },
  get readonly() { return props.readonly; },
  get reorderable() { return props.reorderable; },
  get search() { return props.search.trim(); },
  get activeLabel() { return props.activeLabel; },
  isOpen: (node) => (visible.value ? visible.value.forced.has(node.id) : expanded.value.includes(node.id)),
  isShown: (node) => visible.value?.shown.has(node.id) ?? true,
  toggle: (node) => {
    if (visible.value) return; // the search holds the path open
    expanded.value = expanded.value.includes(node.id) ? expanded.value.filter((id) => id !== node.id) : [...expanded.value, node.id];
  },
  addLabel: (parent, level) => props.addLabel?.(parent as Node | null, level) ?? null,
  add: (parent) => emit("add", parent as Node | null),
  open: (node) => emit("open", node as unknown as Node),
  setActive: (node, active) => emit("toggle", node as unknown as Node, active),
  reorder: (change) => emit("reorder", change),
  actions: (node, depth) => props.rowActions?.(node as unknown as Node, depth) ?? [],
  slot: (name) => slots[name] as ReturnType<TreeContext["slot"]>,
};
provide(treeContextKey, context);

const ACTIONS_WIDTH = "10.5rem";
const SWITCH_WIDTH = "5rem";
const template = computed(() => ["minmax(0,1fr)", ...props.columns.map((column) => `${column.width ?? 160}px`), ...(props.activeLabel !== undefined ? [SWITCH_WIDTH] : []), ACTIONS_WIDTH].join(" "));
const ALIGN = { start: "text-left", center: "text-center", end: "text-right" } as const;
</script>

<template>
  <section class="overflow-hidden rounded-group bg-surface-cell shadow-group" data-test="collection-tree" :style="{ '--tree-columns': template, '--sortable-row-height': '50px' }">
    <div class="overflow-x-auto">
      <div class="min-w-[44rem]" role="group" :aria-label="props.label">
        <div class="tree-header items-center border-b border-border-separator bg-fill/40 py-2 pr-2 pl-4 text-footnote text-content-muted" aria-hidden="true">
          <span>{{ props.nameLabel ?? t("core.tree.name") }}</span>
          <span v-for="column in props.columns" :key="column.key" class="px-2" :class="ALIGN[column.align ?? 'start']">{{ column.label }}</span>
          <span v-if="props.activeLabel !== undefined" class="px-2">{{ props.activeLabel }}</span>
          <span></span>
        </div>
        <CollectionTreeBranch v-if="shownCount > 0" :nodes="(props.nodes as unknown as LooseNode[])" :parent="null" :depth="0" />
        <div v-else class="py-6 text-center" data-test="tree-empty"><slot name="empty"><EmptyState :title="filtering ? t('core.tree.no_match') : t('core.tree.empty')" /></slot></div>
        <button v-if="!props.readonly && context.addLabel(null, 1) !== null && !filtering" type="button" data-test="tree-add-root"
          class="flex h-10 w-full cursor-pointer items-center gap-1 px-4 text-footnote text-content-link hover:bg-fill/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus" @click="emit('add', null)">
          <Icon name="addLine" :size="14" />{{ context.addLabel(null, 1) }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.tree-header {
  display: grid;
  grid-template-columns: var(--tree-columns);
}
</style>
