<script setup lang="ts">
/**
 * The one micro-label scale: small uppercase caption text for field group headers, panel meta
 * rows and key names. Render it as the element that fits (`dt` in a definition list, a heading).
 *
 *   <MicroLabel>Status</MicroLabel>
 *   <MicroLabel as="dt">VIN</MicroLabel>
 */
withDefaults(defineProps<{
  as?: "span" | "p" | "dt" | "div" | "h2" | "h3" | "h4";
}>(), { as: "span" });

defineSlots<{ default?: () => unknown }>();
</script>

<template>
  <component :is="as" class="text-2xs font-semibold uppercase tracking-[0.06em] text-content-muted">
    <slot />
  </component>
</template>
