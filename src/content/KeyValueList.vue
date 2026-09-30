<script lang="ts">
export interface KeyValueItem {
  key: string;
  label: string;
  value?: string | number | null;
}
</script>

<script setup lang="ts">
import KeyValue from "./KeyValue.vue";

/**
 * A grid of read-only label and value pairs in the app's one style (see `KeyValue`): identity
 * cards, detail panels, dialog summaries. For pairs with custom markup use `<dl>` with
 * `<KeyValue>`, or the `value` slot here.
 *
 *   <KeyValueList :columns="3" :items="[
 *     { key: 'make', label: t('make'), value: vehicle.make },
 *     { key: 'vin', label: t('vin'), value: vehicle.vin },
 *   ]" />
 */
const props = withDefaults(defineProps<{
  items: readonly KeyValueItem[];
  /** Grid columns: 1; 2 from `sm`; 3 is 2 from `sm` and 3 from `lg`. */
  columns?: 1 | 2 | 3;
}>(), { columns: 1 });

defineSlots<{
  /** Custom value markup per item. */
  value?: (scope: { item: KeyValueItem }) => unknown;
}>();

const GRID = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
} as const;
</script>

<template>
  <dl class="grid gap-x-6 gap-y-3" :class="GRID[props.columns]">
    <KeyValue v-for="item in props.items" :key="item.key" :label="item.label" :value="item.value" :data-key="item.key">
      <template v-if="$slots.value" #default><slot name="value" :item="item" /></template>
    </KeyValue>
  </dl>
</template>
