<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { FileExplorer, type ExplorerCrumb, type ExplorerRow, type TableColumns } from "@wssto2/vue-core/collection";
import type { PageAction } from "@wssto2/vue-core/page";
import { ref } from "vue";

interface Entry extends ExplorerRow {
  url?: string;
  edited: string;
}

// What the server answered for the open folder: its rows and its path. The explorer owns ticking, opening and the folder in the URL.
defineProps<{ rows: readonly Entry[]; crumbs: readonly ExplorerCrumb[]; remove: (rows: readonly Entry[]) => Promise<void>; edit: (page: Entry) => void }>();

const selected = ref<(string | number)[]>([]);
const folder = ref<string | null>(null); // also `?folder=<id>`: Back goes up, a link opens there
const columns = [
  { key: "url", label: "URL", width: 240 },
  { key: "edited", label: "Last edited", kind: "timestamp", precision: "date", width: 160, hideBelow: "md" },
] satisfies TableColumns<Entry>;

// The bar over the ticked rows exists only while something is ticked.
const batch = (_rows: readonly Entry[]): PageAction[] => [
  { id: "copy", label: "Copy", icon: "copy", onClick: () => undefined },
  { id: "delete", label: "Delete", icon: "deleteBin2Line", tone: "critical", onClick: () => undefined },
];
</script>

<template>
  <FileExplorer v-model:selected="selected" v-model:folder="folder" :rows="rows" :columns="columns" :breadcrumb="crumbs" label="Pages" :selection-actions="batch" @open="edit">
    <template #switch><span>lavcevic.example</span></template>
    <template #toolbar><Button size="sm" prominence="primary" icon="addLine">New</Button></template>
    <template #cell-url="{ value }"><code class="font-mono text-footnote">{{ value }}</code></template>
  </FileExplorer>
</template>
