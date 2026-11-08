<script setup lang="ts">
import FormGroup from "../FormGroup.vue";

/** One group of a `DynamicForm`, or nothing when the form already sits in a group (its rows go there). */
const props = defineProps<{ bare: boolean }>();
defineSlots<{ default?: () => unknown; "header-trailing"?: () => unknown }>();
</script>

<template>
  <slot v-if="props.bare" />
  <FormGroup v-else>
    <slot />
    <template v-if="$slots['header-trailing']" #header-trailing><slot name="header-trailing" /></template>
  </FormGroup>
</template>
