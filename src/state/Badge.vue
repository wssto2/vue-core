<script setup lang="ts">
import type { Tone } from "./tone";

/**
 * The one badge: a status, a phase, a source. The tone carries the meaning; shape, size and case
 * never change, so a screen full of badges reads as one system. A label, not a button: 6 px
 * corners, a hairline in the tone's own colour so it keeps an edge on white rows, medium weight.
 *
 *   <Badge tone="warning" dot>Offer sent</Badge>
 *   <Badge tone="context" dot>Instagram</Badge>
 *
 * `context` is for information that is not a state (where a lead came from): full-contrast
 * neutral text on the cell surface.
 */
const props = withDefaults(defineProps<{
  tone?: Tone | "context";
  dot?: boolean;
}>(), {
  tone: "neutral",
  dot: false,
});

defineSlots<{ default?: () => unknown }>();

// Written out in full so Tailwind generates every class.
const TONES = {
  neutral: { badge: "bg-status-neutral-surface text-status-neutral-content", dot: "bg-status-neutral-content" },
  info: { badge: "bg-status-info-surface text-status-info-content", dot: "bg-status-info-content" },
  positive: { badge: "bg-status-success-surface text-status-success-content", dot: "bg-status-success-content" },
  warning: { badge: "bg-status-warning-surface text-status-warning-content", dot: "bg-status-warning-content" },
  critical: { badge: "bg-status-danger-surface text-status-danger-content", dot: "bg-status-danger-content" },
  context: { badge: "bg-surface-cell text-content", dot: "bg-content-disabled" },
} as const;
</script>

<template>
  <span class="inline-flex items-center gap-x-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-current/20"
    :class="TONES[props.tone].badge">
    <span v-if="props.dot" class="size-1.5 shrink-0 rounded-full" :class="TONES[props.tone].dot" aria-hidden="true"></span>
    <slot />
  </span>
</template>
