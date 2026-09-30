<script setup lang="ts">
import { useTemplateRef } from "vue";
import type { ControlWidth } from "../controls";
import { fieldDefaults, fieldProps, type FieldProps } from "./field";
import NumberField from "./NumberField.vue";

/**
 * An amount of money: a `NumberField` with two decimals and the currency after the number. The currency is
 * shown as given ("EUR", "€"); the amount is a plain number (what the payload carries is the feature's mapping).
 *
 *   <MoneyField v-bind="form.bind('price')" currency="EUR" :label="t('price')" />
 */
const props = withDefaults(
  defineProps<FieldProps & { currency: string; decimals?: number; negative?: boolean; width?: Exclude<ControlWidth, "content"> }>(),
  { ...fieldDefaults, decimals: 2, negative: false, width: "sm" },
);

const model = defineModel<number | null>({ default: null });
const field = useTemplateRef<InstanceType<typeof NumberField>>("field");
defineExpose({ focus: () => field.value?.focus() });
</script>

<template>
  <NumberField ref="field" v-model="model" v-bind="fieldProps(props)" :decimals="props.decimals" :negative="props.negative" :suffix="props.currency" :width="props.width" />
</template>
