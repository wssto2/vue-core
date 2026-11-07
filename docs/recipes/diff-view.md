# A diff of two versions

`DiffView` draws the diff the server computed: one `{ op, text }` per line, `op` being `" "` (unchanged), `"-"` (removed) or `"+"` (added). It does not diff anything itself.

<!-- example: docs/examples/workbench/VersionDiff.vue -->
```vue
<script setup lang="ts">
import { DiffView, type DiffLine } from "@wssto2/vue-core/content";
import { ref } from "vue";

// The server's diff of two versions: one `{ op, text }` per line.
defineProps<{ lines: readonly DiffLine[] }>();
const mode = ref<"unified" | "split">("unified");
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex gap-2">
      <button type="button" :aria-pressed="mode === 'unified'" @click="mode = 'unified'">Unified</button>
      <button type="button" :aria-pressed="mode === 'split'" @click="mode = 'split'">Side by side</button>
    </div>
    <!-- Three unchanged lines around each change; the rest fold into "N unchanged lines". -->
    <DiffView :lines="lines" :mode="mode" :context="3" />
  </div>
</template>
```

| | |
|---|---|
| `lines` | `DiffLine[]` |
| `mode` | `unified` (default; the old and the new line number, one column) or `split` (the old text left, the new right; a run of removed lines meets the added lines that follow it, one for one) |
| `context` | unchanged lines kept around each change (default 3); the rest of a run folds into a "12 unchanged lines" button that opens it. `null` folds nothing. A run of one line is not folded |

A change is told by its sign and by screen-reader text ("added: …", "removed: …"), never by colour alone; a diff without changes says "No differences." in the locale. The text is shown as it is in the mono font and is not highlighted: that would load the code editor for a read-only view. Put it in a `Modal size="xl"` for a version comparison.
