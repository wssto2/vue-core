<script setup lang="ts">
import FormGroup from "../FormGroup.vue";
import FormRow from "../FormRow.vue";

/** One group of a `DynamicForm`, or, when the form already sits in a group (the app's, a collection's card), only its rows. */
const props = defineProps<{ bare: boolean }>();
defineSlots<{ default?: () => unknown; "header-trailing"?: () => unknown }>();
</script>

<template>
  <template v-if="props.bare">
    <!-- No header of its own in someone else's group: the switch is a row of it. -->
    <FormRow v-if="$slots['header-trailing']" layout="stacked"><div class="flex justify-end"><slot name="header-trailing" /></div></FormRow>
    <slot />
  </template>
  <FormGroup v-else>
    <slot />
    <template v-if="$slots['header-trailing']" #header-trailing><slot name="header-trailing" /></template>
  </FormGroup>
</template>
