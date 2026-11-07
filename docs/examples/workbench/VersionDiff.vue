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
