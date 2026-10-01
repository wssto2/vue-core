<script setup lang="ts">
import { computed } from "vue";
import type { Hue } from "./hue";
import type { Tone } from "./tone";

/**
 * The one badge: a status, a phase, a source. Shape, size and case never change, so a screen full of
 * badges reads as one system. A label, not a button: 6 px corners, a hairline in its own colour so it
 * keeps an edge on white rows, medium weight. The label always shows; colour never carries the meaning alone.
 *
 * A status says what state something is in, by `tone`; a category tells things of one kind apart, by `hue`
 * (nine, separate from the tones: a lead's source is not a warning).
 *
 *   <Badge tone="warning" dot>Offer sent</Badge>
 *   <Badge hue="violet">Instagram</Badge>                       tinted
 *   <Badge hue="violet" appearance="dot">Instagram</Badge>      neutral label with a coloured dot
 *
 * `tone="context"` is information that is not a state, in full-contrast neutral text on the cell surface.
 */
const props = defineProps<{
  /** A state. Ignored when `hue` is given. */
  tone?: Tone | "context";
  /** A dot before the label, in the tone's colour (tones only: a hue's dot is `appearance="dot"`). */
  dot?: boolean;
  /** A category colour. */
  hue?: Hue;
  /** With a `hue`: `"tinted"` (default) colours the badge, `"dot"` keeps a neutral label and colours a dot. */
  appearance?: "tinted" | "dot";
}>();

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

const HUES = {
  amber: { badge: "bg-category-amber-surface text-category-amber-content", dot: "bg-category-amber-content" },
  lime: { badge: "bg-category-lime-surface text-category-lime-content", dot: "bg-category-lime-content" },
  teal: { badge: "bg-category-teal-surface text-category-teal-content", dot: "bg-category-teal-content" },
  cyan: { badge: "bg-category-cyan-surface text-category-cyan-content", dot: "bg-category-cyan-content" },
  blue: { badge: "bg-category-blue-surface text-category-blue-content", dot: "bg-category-blue-content" },
  indigo: { badge: "bg-category-indigo-surface text-category-indigo-content", dot: "bg-category-indigo-content" },
  violet: { badge: "bg-category-violet-surface text-category-violet-content", dot: "bg-category-violet-content" },
  fuchsia: { badge: "bg-category-fuchsia-surface text-category-fuchsia-content", dot: "bg-category-fuchsia-content" },
  pink: { badge: "bg-category-pink-surface text-category-pink-content", dot: "bg-category-pink-content" },
} as const;

// What is drawn: the badge colours, and the dot's colour when there is a dot.
const look = computed(() => {
  const { hue, appearance, tone, dot } = props;
  if (hue === undefined) {
    const colours = TONES[tone ?? "neutral"];
    return { badge: colours.badge, dot: dot ? colours.dot : null };
  }
  // The dot style keeps the neutral label of `context` (full contrast) and lets only the dot carry the hue.
  return appearance === "dot" ? { badge: TONES.context.badge, dot: HUES[hue].dot } : { badge: HUES[hue].badge, dot: null };
});
</script>

<template>
  <span class="inline-flex items-center gap-x-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-current/20"
    :class="look.badge" :data-hue="props.hue">
    <span v-if="look.dot" class="size-1.5 shrink-0 rounded-full" :class="look.dot" aria-hidden="true"></span>
    <slot />
  </span>
</template>
