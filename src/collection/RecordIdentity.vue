<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";
import { RouterLink } from "vue-router";
import { computed } from "vue";
import { highlightParts } from "./highlight";

/**
 * A record's name in a list row, with an optional quiet line under it (an e-mail, a number). The
 * name is a real link to the record (keyboard, modified click and open-in-new-tab work); the line
 * can stay selectable inside a row that opens the record on click, so contact details can be copied.
 *
 *   <RecordIdentity :to="recordRoute" :title="name" :subtitle="email" subtitle-selectable />
 *
 * `spread` (the phone row) lets the two lines be cells of the grid they sit in: the title in the first column of the first
 * row, the subtitle across the full width of the second, so something beside the title (a status) never narrows the subtitle.
 *
 * `highlight` (the list's search text) marks where it matches the title, in `<mark>`: what found the row is visible.
 */
const props = withDefaults(defineProps<{
  title: string;
  subtitle?: string | null;
  /** Where the record lives; without it the title is plain text. */
  to?: RouteLocationRaw | null;
  /** Keeps the subtitle's text selectable when the surrounding row navigates on click. */
  subtitleSelectable?: boolean;
  /** The search text to mark in the title (its words, any case). */
  highlight?: string | null;
  /** Lays the lines out as cells of the parent grid (see above) instead of a column of its own. */
  spread?: boolean;
}>(), {
  spread: false,
  highlight: null,
  subtitle: null,
  to: null,
  subtitleSelectable: false,
});

const mark = "rounded-sm bg-status-warning-surface text-status-warning-content";
const SPREAD_TITLE = "col-start-1 row-start-1";
// max-w-full: `w-fit` alone would size a nowrap line to its whole text and let it run out of the card instead of ending in an ellipsis.
const SPREAD_SUBTITLE = "col-span-full row-start-2 max-w-full";
const parts = computed(() => highlightParts(props.title, props.highlight));
</script>

<template>
  <div :class="props.spread ? 'contents' : 'flex min-w-0 flex-col'">
    <RouterLink v-if="props.to" :to="props.to"
      class="block truncate rounded-sm text-row-title focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus" :class="props.spread ? SPREAD_TITLE : undefined">
      <template v-for="(part, index) in parts" :key="index"><mark v-if="part.match" :class="mark">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template>
    </RouterLink>
    <span v-else class="truncate text-row-title" :class="props.spread ? SPREAD_TITLE : undefined"><template v-for="(part, index) in parts" :key="index"><mark v-if="part.match" :class="mark">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></span>

    <!-- A click in it is left to the text (selection), not taken by the row. -->
    <span v-if="props.subtitle" :data-row-click-ignore="props.subtitleSelectable ? '' : undefined"
      class="truncate text-row-subtitle" :class="[props.subtitleSelectable ? 'w-fit cursor-text select-text' : undefined, props.spread ? SPREAD_SUBTITLE : undefined]">
      {{ props.subtitle }}
    </span>
  </div>
</template>
