<script setup lang="ts">
import { Timestamp } from "@wssto2/vue-core/content";

defineProps<{ row: { updated_at: string; updated_by: string } }>();
</script>

<template>
  <Timestamp :value="row.updated_at" :author="{ name: row.updated_by }" />
</template>
