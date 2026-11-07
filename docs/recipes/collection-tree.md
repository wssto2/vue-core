# A tree list: groups that open

`CollectionTree` (`@wssto2/vue-core/collection`) is a list whose rows have rows: groups with items, as deep as the data goes (lookup lists, categories, a menu). It indents by level, opens and closes with a chevron, lets the user reorder rows **among their siblings**, offers an add button at each level, and can show a column on some branches only.

<!-- example: docs/examples/lists/BrandTree.vue -->
```vue
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
```

## What it does

| | |
|---|---|
| `nodes` | `TreeNode`s: `{ id, label, active?, children? }` (your own fields too; `id` must be unique in the whole tree). A node with `children` is a group, one without is an item. |
| `v-model:expanded` | the ids of the open groups. The chevron is a button with `aria-expanded`; a closed group shows how many items it holds. |
| `reorderable`, `@reorder` | each group's children are a `SortableList` of their own: drag the handle, or press Alt+↑ / Alt+↓ on it. `@reorder` says `{ id, parentId, index }` (index among the parent's children, from 0). A row cannot leave its parent. The tree does not move rows itself: give it the nodes in their new order at once, and tell the server. |
| `columns` | `TreeColumn`s: `{ key, label, width?, visible?(node, depth) }`. A column with `visible` belongs to some rows ("Brand code" under the brands), blank on the others; the header always shows, so the columns do not jump when a branch opens. `#cell-<key>` draws a cell; without it the node's `[key]` is shown. |
| `active-label`, `@toggle` | adds the switch column over `node.active` (a node without a boolean has no switch); `@toggle(node, active)`. |
| `add-label(parent, level)`, `@add(parent)` | the text of the add button of that level (from 1), or `null` for none. A group with items shows it at the end of its items, one that is empty or closed at the end of its row. The roots' add (`parent` null) shows at the bottom if you give it a label; a page usually has its own. |
| `search`, `filter` | leave the rows that match and **every ancestor of one**, opened while it lasts; text matches ignore case and accents. Reordering is off while they hide rows (an index among some siblings would be wrong). |
| `row-actions(node, depth)`, `@open(node)` | the More menu, and a click on the name. |
| `readonly` | takes away handles, switches and add buttons and keeps the rest (a viewer). |

The sketch's `columns(node)` (a function of the node) became `visible` per column: the header can stay and the cell is blank, which is what the approved mock-ups draw. Its `#add-label` slot is the `add-label` function: a label is text, not a template.

## Notes

- Keys and ids: if the tree is made of several tables whose ids repeat, build `id` as `"<level>:<id>"` (`CharacteristicsPage` does).
- `SortableList` has a `plain` mode for this: no card per row, the handle at the top of a row that holds its own list.
