<script setup lang="ts">
import { Icon, type IconName } from "../icon";

/**
 * A rounded square carrying an icon or one or two letters: the leading visual of a grouped row,
 * a navigation item or a record header. Decorative: the row or button next to it owns the
 * accessible name.
 *
 *   <IconTile tone="brand" icon="carLine" />            the app's own programmes
 *   <IconTile tone="anchor" text="N" />                 integrations, navigation
 *   <IconTile tone="neutral" icon="serverLine" size="lg" />   system and export
 */
const props = withDefaults(defineProps<{
  tone?: "brand" | "anchor" | "neutral";
  icon?: IconName;
  text?: string;
  /** `row` follows the theme's row metrics (22 px desktop, 29 px compact). */
  size?: "row" | "md" | "lg";
}>(), {
  tone: "anchor",
  icon: undefined,
  text: undefined,
  size: "row",
});

// Written out in full so Tailwind generates every class.
const TONES = {
  brand: "bg-tile-brand text-tile-brand-foreground",
  anchor: "bg-tile-anchor text-tile-anchor-foreground",
  neutral: "bg-tile-neutral text-tile-neutral-foreground",
} as const;

const SIZES = {
  row: { box: "size-tile rounded-md", text: "text-caption" },
  md: { box: "size-11 rounded-xl", text: "text-base" },
  lg: { box: "size-14 rounded-2xl", text: "text-xl" },
} as const;
</script>

<template>
  <span aria-hidden="true" :data-tone="props.tone"
    class="inline-flex shrink-0 select-none items-center justify-center" :class="[TONES[props.tone], SIZES[props.size].box]">
    <Icon v-if="props.icon" :name="props.icon" :size="20" class="size-[62%]" />
    <span v-else-if="props.text" class="font-semibold leading-none" :class="SIZES[props.size].text">{{ props.text }}</span>
  </span>
</template>
