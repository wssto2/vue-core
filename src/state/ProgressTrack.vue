<script setup lang="ts">
import { computed } from "vue";

/**
 * Progress in place for a wait of several seconds whose end the app cannot know (one request to a
 * slow service). The caller moves `value` (0–100) stage by stage, each move easing over
 * `durationMs`; it never shows more than 95 until `done`, which fills it quickly. `hairline` is
 * the 2 px line along the top of a sheet; the default is a 6 px rounded track.
 */
const props = withDefaults(defineProps<{
  value: number;
  done?: boolean;
  durationMs?: number;
  hairline?: boolean;
  label?: string;
}>(), { done: false, durationMs: 1000, hairline: false, label: undefined });

const shown = computed(() => (props.done ? 100 : Math.min(Math.max(props.value, 0), 95)));
const duration = computed(() => `${props.done ? 350 : props.durationMs}ms`);
</script>

<template>
  <div class="w-full overflow-hidden" :class="props.hairline ? 'h-0.5' : 'h-1.5 rounded-full bg-tint-soft'"
    role="progressbar" :aria-label="props.label" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.round(shown)">
    <div class="h-full bg-control-on ease-motion-standard motion-reduce:transition-none"
      :class="props.hairline ? '' : 'rounded-full'"
      :style="{ width: `${shown}%`, transitionProperty: 'width', transitionDuration: duration }" />
  </div>
</template>
