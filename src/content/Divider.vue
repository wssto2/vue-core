<script setup lang="ts">
/** A horizontal rule, optionally with a short label in the middle ("or enter it manually"). */
defineProps<{ label?: string }>();
</script>

<template>
  <div role="separator" class="my-2 flex items-center gap-4">
    <span class="h-px flex-1 bg-border-separator"></span>
    <span v-if="label" class="select-none whitespace-nowrap font-mono text-2xs uppercase tracking-widest text-content-muted">{{ label }}</span>
    <span class="h-px flex-1 bg-border-separator"></span>
  </div>
</template>
