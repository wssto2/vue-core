<script setup lang="ts">
/** A section's title and one line on what it holds, above its groups; `#actions` puts a quiet action at its end. */
defineProps<{ title: string; description?: string }>();
defineSlots<{ actions?: () => unknown }>();
</script>

<template>
  <div class="flex flex-wrap items-end gap-3 px-row-inset">
    <div class="flex min-w-0 grow basis-56 flex-col gap-1">
      <h2 class="text-title font-semibold tracking-tight text-content-strong">{{ title }}</h2>
      <p v-if="description" class="max-w-readable text-subheadline text-content-muted">{{ description }}</p>
    </div>
    <slot name="actions" />
  </div>
</template>
