# A file explorer: folders, pages, links and files

`FileExplorer` (`@wssto2/vue-core/collection`) is the list of a place that has folders: the pages of a host, the resources of a template, uploaded files. It draws one card: a header with the **host switch** (`#switch`), the **breadcrumb** and the page's own buttons (`#toolbar`), a **selection bar** that exists only while rows are ticked, and the rows. The app fetches the rows of the open folder and its path; the explorer owns what the user does with them.

<!-- example: docs/examples/lists/PagesExplorer.vue -->
```vue
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
```

## What it does

| | |
|---|---|
| `rows` | `ExplorerRow`s: `{ id, kind: "folder" \| "page" \| "link" \| "file", name }` plus whatever your columns show. A folder row has the folder icon, a page the page icon, a link the external-link icon; `#icon` replaces it (a thumbnail for an image). |
| `columns` | the collection's `TableColumns` (kinds, `align`, `width`, `hideBelow`, typed `#cell-<key>` slots). The name with its icon is always the first column; `name-label` renames its header. |
| `v-model:selected` | the ids of the ticked rows. The header box ticks all (a partial selection is indeterminate); the selection is cleared when the folder changes. |
| `selection-actions(rows)` | the buttons of the bar, as the page's own `PageAction`s (`label`, `icon`, `tone: "critical"` for red, `disabled`). The bar says "2 selected" (Croatian plurals) and has *Clear selection*. |
| `row-actions(row)` | the row's More menu (`RowAction[]`, the same as a table's). Each button is named with the row ("More actions: Kontakt"). |
| `@open(row)` | a page, a link or a file was activated (a click on its name or on the row). A folder never emits it: it walks. |
| `v-model:folder`, `breadcrumb` | the open folder's id (`null`: root) and the path, root first. A folder row or a breadcrumb step sets the folder **and the query parameter** `param` (default `folder`): Back goes up and a link opens there. `:param="null"` keeps it out of the URL; without a router it is plain state. |

The sketch in site-builder's `ui.md` had `#row-actions` and a toolbar slot of actions; this version takes `row-actions` as data (so the More menu, the context-menu and the labels are the library's) and puts the page's own buttons in `#toolbar`, because only the selection bar's actions are the same kind of thing as a page's.

## Notes

- Rows are the app's: the explorer never moves, copies or deletes anything. Do it in the bar's `onClick`, then fetch the folder again.
- Under 1024 px the table scrolls sideways; give the secondary columns `hideBelow` to keep the name and the More button on screen.
- Colour is never the only signal: a folder row has a screen-reader word ("Folder"), a ticked row `aria-selected`.
