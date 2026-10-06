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
 *   <IconTile weight="soft" size="sm" icon="user" />        a list row's leading mark: quiet, not a block
 *
 * `weight="soft"` is a light tint of the tone with its glyph (and a hairline ring) instead of the solid fill:
 * for tiles on white surfaces, where a solid block reads as a missing photo.
 */
const props = withDefaults(defineProps<{
  tone?: "brand" | "anchor" | "neutral";
  icon?: IconName;
  text?: string;
  /** `solid` (default) fills the tile; `soft` is a light tint with the tone's glyph. */
  weight?: "solid" | "soft";
  /** `row` follows the theme's row metrics (22 px desktop, 29 px compact); `sm` is 32 px, a list row's leading tile. */
  size?: "row" | "sm" | "md" | "lg";
}>(), {
  weight: "solid",
  tone: "anchor",
  icon: undefined,
  text: undefined,
  size: "row",
});

// Written out in full so Tailwind generates every class.
const TONES = {
  solid: {
    brand: "bg-tile-brand text-tile-brand-foreground",
    anchor: "bg-tile-anchor text-tile-anchor-foreground",
    neutral: "bg-tile-neutral text-tile-neutral-foreground",
  },
  soft: {
    brand: "bg-tile-brand-soft text-tile-brand-soft-foreground ring-1 ring-inset ring-current/15",
    anchor: "bg-tint-soft text-content-link ring-1 ring-inset ring-current/15",
    neutral: "bg-fill text-content-muted ring-1 ring-inset ring-current/15",
  },
} as const;

const SIZES = {
  row: { box: "size-tile rounded-md", text: "text-caption" },
  sm: { box: "size-8 rounded-md", text: "text-footnote" },
  md: { box: "size-11 rounded-xl", text: "text-base" },
  lg: { box: "size-14 rounded-2xl", text: "text-xl" },
} as const;
</script>

<template>
  <span aria-hidden="true" :data-tone="props.tone" :data-weight="props.weight"
    class="inline-flex shrink-0 select-none items-center justify-center" :class="[TONES[props.weight][props.tone], SIZES[props.size].box]">
    <Icon v-if="props.icon" :name="props.icon" :size="20" class="size-[62%]" />
    <span v-else-if="props.text" class="font-semibold leading-none" :class="SIZES[props.size].text">{{ props.text }}</span>
  </span>
</template>
