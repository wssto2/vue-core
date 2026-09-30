<script setup lang="ts">
import { computed, getCurrentInstance, inject } from "vue";
import { bottomDockKey } from "./bottomDock";

/**
 * Puts its content in the app's bottom dock (`BottomDock`): stacked with the other pinned bars,
 * the page padded for it, toasts lifted above it. Without a dock (a component mounted on its own)
 * it renders in place.
 *
 *   <BottomDockPortal><div class="dock-safe-area pointer-events-auto …">…actions…</div></BottomDockPortal>
 */
defineSlots<{ default?: () => unknown }>();

// Optional: without a dock the content renders in place.
const dock = getCurrentInstance() ? inject(bottomDockKey, null) : null;
const target = computed(() => dock?.value ?? null);
</script>

<template>
  <Teleport :to="target" :disabled="!target">
    <slot />
  </Teleport>
</template>
