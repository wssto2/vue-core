<script setup lang="ts">
import { computed } from "vue";
import { highlightParts } from "./highlight";

/**
 * A text with the words of `search` marked in `<mark>` (whitespace-separated, any case, as `highlightParts` reads them): what
 * found a row is visible. It renders no element of its own, only the text and the marks, so it sits inside any line.
 *
 *   <Highlight :text="vehicle.name" :search="collection.search.value" />
 */
const props = defineProps<{ text: string; search?: string | null }>();

const parts = computed(() => highlightParts(props.text, props.search));
</script>

<template>
  <template v-for="(part, index) in parts" :key="index"><mark v-if="part.match" class="rounded-sm bg-status-warning-surface text-status-warning-content">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template>
</template>
