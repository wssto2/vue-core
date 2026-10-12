<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { initialsFor } from "./initials";

/**
 * A person's initials on a quiet fill, for records that have no photo (leads, customers).
 * Decorative: the name is always written next to it.
 *
 *   <Avatar name="Josip Žlimen" size="md" />
 *   <Avatar name="Josip Žlimen" size="xl" tone="anchor" />     the monogram of a record header
 *   <Avatar name="Josip Žlimen" :src="user.photoUrl" />        the photo, initials until it loads
 *
 * `src` is a full URL the app has already built (no fetching or auth here). The initials show when
 * it is empty, while it loads and if it fails to load: never a broken-image icon. A changed `src` retries.
 */
const props = withDefaults(defineProps<{
  name?: string | null;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  tone?: "neutral" | "anchor";
}>(), {
  name: "",
  src: null,
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

const loaded = ref(false);
const failed = ref(false);
watch(() => props.src, () => {
  loaded.value = false;
  failed.value = false;
});
</script>

<template>
  <span aria-hidden="true" class="relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold"
    :class="[SIZES[props.size], TONES[props.tone]]">{{ initials }}<img v-if="props.src && !failed" :key="props.src" :src="props.src" :alt="props.name ?? ''" draggable="false"
      :data-loaded="loaded || undefined" class="absolute inset-0 size-full rounded-full object-cover" :class="loaded ? '' : 'opacity-0'"
      @load="loaded = true" @error="failed = true" /></span>
</template>
