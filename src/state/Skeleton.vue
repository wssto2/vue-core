<script setup lang="ts">
/**
 * A placeholder bar for content on its way. Decorative (the region that holds it announces the
 * wait); sized by the caller (`class="h-10 w-2/3"`), a text-line high by default. It pulses,
 * except under reduced motion.
 */
</script>

<template>
  <div class="h-4 w-full animate-pulse rounded-lg bg-fill-strong motion-reduce:animate-none" aria-hidden="true"></div>
</template>
