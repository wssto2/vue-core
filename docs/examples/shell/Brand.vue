<script setup lang="ts">
// The logo the shell asks for: `tone` says where it sits, light on the dark sidebar, brand-coloured on the page.
defineProps<{ tone: "light" | "brand" }>();
</script>

<template>
  <span class="text-headline font-semibold" :class="tone === 'light' ? 'text-white' : 'text-tint'">Acme</span>
</template>
