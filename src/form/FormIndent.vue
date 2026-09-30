<script setup lang="ts">
import { provide } from "vue";
import { formRowIndentKey, useFormRowIndent } from "./field";

/**
 * Indents the rows inside it one level (at most two): fields a switch above them reveals. It renders no
 * element of its own, so the rows stay direct children of the group.
 *
 *   <SwitchField v-bind="form.bind('vatIncluded')" label="VAT included" />
 *   <FormIndent v-if="form.values.vatIncluded"><SwitchField v-bind="form.bind('vatImport')" label="Import" /></FormIndent>
 */
provide(formRowIndentKey, useFormRowIndent() + 1);
defineSlots<{ default?: () => unknown }>();
</script>

<template>
  <slot />
</template>
