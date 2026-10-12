<script setup lang="ts">
import { AsyncSection, asyncState } from "@wssto2/vue-core/state";

// A store's flags: `documents` is undefined until the answer comes.
defineProps<{ loading: boolean; error: string | null; documents?: readonly string[] }>();
defineEmits<{ retry: [] }>();
</script>

<template>
  <AsyncSection :state="asyncState({ loading, error, value: documents })" @retry="$emit('retry')">
    <template #default="{ value }"><ul><li v-for="name in value" :key="name">{{ name }}</li></ul></template>
  </AsyncSection>
</template>
