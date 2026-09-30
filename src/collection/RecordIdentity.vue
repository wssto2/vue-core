<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";
import { RouterLink } from "vue-router";

/**
 * A record's name in a list row, with an optional quiet line under it (an e-mail, a number). The
 * name is a real link to the record (keyboard, modified click and open-in-new-tab work); the line
 * can stay selectable inside a row that opens the record on click, so contact details can be copied.
 *
 *   <RecordIdentity :to="recordRoute" :title="name" :subtitle="email" subtitle-selectable />
 */
const props = withDefaults(defineProps<{
  title: string;
  subtitle?: string | null;
  /** Where the record lives; without it the title is plain text. */
  to?: RouteLocationRaw | null;
  /** Keeps the subtitle's text selectable when the surrounding row navigates on click. */
  subtitleSelectable?: boolean;
}>(), {
  subtitle: null,
  to: null,
  subtitleSelectable: false,
});
</script>

<template>
  <div class="flex min-w-0 flex-col">
    <RouterLink v-if="props.to" :to="props.to"
      class="block truncate rounded-sm text-row-title focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus">
      {{ props.title }}
    </RouterLink>
    <span v-else class="truncate text-row-title">{{ props.title }}</span>

    <!-- A click in it is left to the text (selection), not taken by the row. -->
    <span v-if="props.subtitle" :data-row-click-ignore="props.subtitleSelectable ? '' : undefined"
      class="truncate text-row-subtitle" :class="{ 'w-fit cursor-text select-text': props.subtitleSelectable }">
      {{ props.subtitle }}
    </span>
  </div>
</template>
