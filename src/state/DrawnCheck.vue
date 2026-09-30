<script setup lang="ts">
/**
 * A checkmark that draws itself: only for something that is now done (a search that found, a
 * valuation that arrived, a save). `circle` rings it. Under reduced motion it is simply there.
 */
const props = withDefaults(defineProps<{ size?: number; circle?: boolean }>(), { size: 16, circle: false });
</script>

<template>
  <svg :width="props.size" :height="props.size" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    :stroke-width="props.circle ? 2 : 2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="shrink-0">
    <circle v-if="props.circle" cx="12" cy="12" r="10"
      class="[stroke-dasharray:64] [stroke-dashoffset:64] animate-[app-draw_450ms_ease-out_forwards] motion-reduce:animate-none motion-reduce:[stroke-dashoffset:0]" />
    <path :d="props.circle ? 'M7.5 12.5l3 3 6-6.5' : 'M5 12.5l4.5 4.5L19 7.5'"
      class="[stroke-dasharray:24] [stroke-dashoffset:24] motion-reduce:animate-none motion-reduce:[stroke-dashoffset:0]"
      :class="props.circle ? 'animate-[app-draw_300ms_300ms_ease-out_forwards]' : 'animate-[app-draw_400ms_50ms_ease-out_forwards]'" />
  </svg>
</template>
