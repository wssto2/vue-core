<script setup lang="ts">
import type { Tone } from "./tone";

/**
 * A small status dot in a tone's colour: before the label of a menu item, an option or a token, where a whole
 * `Badge` would be too loud. Decorative: the label next to it names the status.
 *
 *   <ToneDot tone="positive" />
 */
const props = defineProps<{ tone: Tone }>();

// Written out in full so Tailwind generates every class.
const DOT = {
  neutral: "bg-status-neutral-content",
  info: "bg-status-info-content",
  positive: "bg-status-success-content",
  warning: "bg-status-warning-content",
  critical: "bg-status-danger-content",
} as const;
</script>

<template>
  <span aria-hidden="true" :data-tone="props.tone" class="inline-block size-2 shrink-0 rounded-full" :class="DOT[props.tone]"></span>
</template>
