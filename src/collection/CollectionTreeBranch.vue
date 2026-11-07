<script setup lang="ts">
import { computed, defineComponent, inject, type PropType } from "vue";
import { useI18n } from "vue-i18n";
import SortableList from "../controls/SortableList.vue";
import IconTile from "../controls/IconTile.vue";
import { Icon } from "../icon";
import Highlight from "./Highlight.vue";
import RowMore from "./RowMore.vue";
import { treeContextKey, type LooseNode } from "./tree";

/**
 * The children of one parent (internal to `CollectionTree`): a sortable list of rows, each with its own branch below it while it is open,
 * and the "add" row at the end of an open branch. Rows can only be reordered among their siblings because each branch is its own list.
 */
const props = defineProps<{ nodes: readonly LooseNode[]; parent: LooseNode | null; depth: number }>();

const ctx = inject(treeContextKey);
if (!ctx) throw new Error("CollectionTreeBranch is only used inside CollectionTree.");
const { t } = useI18n();

// What a slot renders: a function of the app's slot, called where the template needs it.
const Render = defineComponent({
  props: { fn: { type: Function as PropType<(scope: { node: LooseNode; depth: number }) => unknown>, default: undefined }, node: { type: Object as PropType<LooseNode>, required: true }, depth: { type: Number, required: true } },
  setup: (p) => () => p.fn?.({ node: p.node, depth: p.depth }) as never,
});

const shown = computed(() => props.nodes.filter((node) => ctx.isShown(node)));
const sortable = computed(() => ctx.reorderable && !ctx.readonly && ctx.search === "" && shown.value.length === props.nodes.length);
const hasChildren = (node: LooseNode) => (node.children?.length ?? 0) > 0;
const cell = (column: { key: string; visible?: (node: LooseNode, depth: number) => boolean }, node: LooseNode) => column.visible?.(node, props.depth) ?? true;
const align = { start: "justify-start text-left", center: "justify-center text-center", end: "justify-end text-right" } as const;
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";
</script>

<template>
  <SortableList :model-value="shown" :item-key="'id'" plain :disabled="!sortable" :label="props.parent?.label" :item-label="(entry) => entry.label"
    @update:model-value="() => undefined" @move="(node: LooseNode, _from: number, to: number) => ctx.reorder({ id: node.id, parentId: props.parent?.id ?? null, index: to })">
    <template #item="{ item: node }">
      <div class="flex flex-col" data-test="tree-node" :data-depth="props.depth">
        <div class="tree-row h-[50px] items-center border-b border-border-separator pr-2 hover:bg-fill/40">
          <div class="flex min-w-0 items-center gap-2">
            <button v-if="hasChildren(node)" type="button" :aria-expanded="ctx.isOpen(node)" :aria-label="t(ctx.isOpen(node) ? 'core.tree.collapse' : 'core.tree.expand', { name: node.label })"
              class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-content-muted hover:bg-fill" :class="FOCUS" @click="ctx.toggle(node)">
              <Icon name="arrowRightSLine" :size="16" class="transition-transform duration-motion-fast" :class="ctx.isOpen(node) ? 'rotate-90' : ''" />
            </button>
            <span v-else class="size-6 shrink-0" aria-hidden="true"></span>
            <Render v-if="ctx.slot('icon')" :fn="ctx.slot('icon')" :node="node" :depth="props.depth" />
            <IconTile v-else size="sm" :tone="props.depth === 0 ? 'brand' : 'anchor'" :icon="node.children ? 'folderLine' : 'tagLine'" />
            <button type="button" class="min-w-0 truncate text-left text-body text-content-strong hover:underline" :class="[FOCUS, node.active === false ? 'text-content-muted' : '']" @click="ctx.open(node)"><Highlight :text="node.label" :search="ctx.search" /></button>
            <span v-if="hasChildren(node) && !ctx.isOpen(node)" class="text-footnote text-content-muted" data-test="tree-count">{{ node.children?.length }}</span>
          </div>
          <div v-for="column in ctx.columns" :key="column.key" role="group" :aria-label="column.label" class="flex min-w-0 items-center px-2 text-body" :class="align[column.align ?? 'start']">
            <template v-if="cell(column, node)">
              <Render v-if="ctx.slot(`cell-${column.key}`)" :fn="ctx.slot(`cell-${column.key}`)" :node="node" :depth="props.depth" />
              <span v-else class="truncate">{{ node[column.key] ?? "" }}</span>
            </template>
          </div>
          <div v-if="ctx.activeLabel !== undefined" role="group" :aria-label="ctx.activeLabel" class="flex items-center px-2">
            <button v-if="typeof node.active === 'boolean'" type="button" role="switch" :aria-checked="node.active" :aria-label="`${ctx.activeLabel}: ${node.label}`" :disabled="ctx.readonly" data-test="tree-active"
              class="hit-target relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-motion-fast disabled:cursor-not-allowed disabled:opacity-45" :class="[node.active ? 'bg-control-on' : 'bg-fill-strong', FOCUS]" @click="ctx.setActive(node, !node.active)">
              <span class="pointer-events-none absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-knob transition-transform duration-motion-normal" :class="node.active ? 'translate-x-4' : ''" />
            </button>
          </div>
          <div class="flex items-center justify-end gap-1">
            <button v-if="!ctx.readonly && ctx.addLabel(node, props.depth + 2) !== null && (!ctx.isOpen(node) || !hasChildren(node))" type="button" data-test="tree-add-row"
              class="inline-flex cursor-pointer items-center gap-1 rounded-full bg-fill px-2.5 py-1 text-footnote text-content-strong hover:bg-fill-strong" :class="FOCUS" @click="ctx.add(node)">
              <Icon name="addLine" :size="14" /><span>{{ ctx.addLabel(node, props.depth + 2) }}</span>
            </button>
            <RowMore :actions="ctx.actions(node, props.depth)" :label="node.label" />
          </div>
        </div>
        <CollectionTreeBranch v-if="hasChildren(node) && ctx.isOpen(node)" :nodes="node.children ?? []" :parent="node" :depth="props.depth + 1" />
        <div v-if="hasChildren(node) && ctx.isOpen(node) && ctx.addLabel(node, props.depth + 2) !== null && !ctx.readonly" class="border-b border-border-separator">
          <button type="button" data-test="tree-add-footer" class="flex h-10 w-full cursor-pointer items-center gap-1 pl-16 text-footnote text-content-link hover:bg-fill/40" :class="FOCUS" @click="ctx.add(node)">
            <Icon name="addLine" :size="14" />{{ ctx.addLabel(node, props.depth + 2) }}
          </button>
        </div>
      </div>
    </template>
  </SortableList>
</template>

<style scoped>
.tree-row {
  display: grid;
  grid-template-columns: var(--tree-columns);
}
</style>
