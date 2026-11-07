<script setup lang="ts">
import { CollectionTree, type TreeColumn, type TreeNode, type TreeReorder } from "@wssto2/vue-core/collection";
import { ref } from "vue";

interface Entry extends TreeNode<Entry> {
  code?: string;
}

// The nodes carry their children; reordering is told, not done: put the nodes in their new order (here the app does, then asks the server).
const props = defineProps<{ roots: readonly Entry[]; move: (change: TreeReorder) => Promise<void> }>();

const expanded = ref<(string | number)[]>([]);
const search = ref("");
// "Code" belongs to the items of the brands list only: blank on every other row.
const columns: TreeColumn<Entry>[] = [{ key: "code", label: "Brand code", visible: (node) => node.code !== undefined }];
const addLabel = (_parent: Entry | null, level: number) => (level === 1 ? null : level === 2 ? "Add list" : "Add item"); // null: no add button (the page has its own for roots)
</script>

<template>
  <CollectionTree v-model:expanded="expanded" :nodes="props.roots" :columns="columns" label="Characteristics" reorderable active-label="Active" :search="search" :add-label="addLabel"
    @reorder="props.move" @add="(parent) => console.info('add below', parent?.id)" @toggle="(node, active) => console.info(node.id, active)" @open="(node) => console.info('open', node.id)">
    <template #cell-code="{ node }"><code>{{ node.code }}</code></template>
  </CollectionTree>
</template>
