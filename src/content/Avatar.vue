<script setup lang="ts">
import { computed } from "vue";
import { initialsFor } from "./initials";

/**
 * A person's initials on a quiet fill, for records that have no photo (leads, customers).
 * Decorative: the name is always written next to it.
 *
 *   <Avatar name="Josip Žlimen" size="md" />
 *   <Avatar name="Josip Žlimen" size="xl" tone="anchor" />     the monogram of a record header
 */
const props = withDefaults(defineProps<{
  name?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  tone?: "neutral" | "anchor";
}>(), {
  name: "",
  size: "sm",
  tone: "neutral",
});

const SIZES = {
  xs: "size-5 text-3xs",
  sm: "size-7 text-2xs",
  md: "size-9 text-xs",
  lg: "size-12 text-base",
  // Record header: 72px on wide screens, 96px on compact ones. Square by aspect ratio, so it
  // can shrink in a very narrow column (enlarged text).
  xl: "aspect-square w-18 max-w-full text-2xl compact:w-24 compact:text-3xl",
} as const;

const TONES = {
  neutral: "bg-fill text-content-muted",
  anchor: "bg-tile-anchor text-tile-anchor-foreground",
} as const;

const initials = computed(() => initialsFor(props.name));
</script>

<template>
  <span aria-hidden="true" class="inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold"
    :class="[SIZES[props.size], TONES[props.tone]]">{{ initials }}</span>
</template>
