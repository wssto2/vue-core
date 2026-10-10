<script setup lang="ts">
import { useTemplateRef } from "vue";
import type { ControlWidth } from "../controls";
import { fieldDefaults, fieldProps, type FieldProps, type FieldSlots } from "./field";
import NumberField from "./NumberField.vue";

/**
 * An amount of money: a `NumberField` with two decimals and the currency after the number. The currency is
 * shown as given ("EUR", "€"); the amount is a plain number (what the payload carries is the feature's mapping).
 *
 *   <MoneyField v-bind="form.bind('price')" currency="EUR" :label="t('price')" />
 */
const props = withDefaults(
  defineProps<FieldProps & { modelValue?: number | null; currency: string; decimals?: number; blankZero?: boolean; negative?: boolean; width?: Exclude<ControlWidth, "content"> }>(),
  { ...fieldDefaults, modelValue: undefined, decimals: 2, blankZero: false, negative: false, width: "sm" },
);

const emit = defineEmits<{ "update:modelValue": [value: number | null]; focus: [event: FocusEvent]; blur: [event: FocusEvent] }>();
const field = useTemplateRef<InstanceType<typeof NumberField>>("field");
defineExpose({ focus: () => field.value?.focus() });
defineSlots<FieldSlots>();
</script>

<template>
  <NumberField ref="field" :model-value="props.modelValue" @update:model-value="emit('update:modelValue', $event)" v-bind="fieldProps(props)" :decimals="props.decimals" :negative="props.negative" :blank-zero="props.blankZero" :suffix="props.currency" :width="props.width" @focus="emit('focus', $event)" @blur="emit('blur', $event)">
    <template v-if="$slots.trailing" #trailing><slot name="trailing" /></template>
    <template v-if="$slots.labelTrailing" #labelTrailing><slot name="labelTrailing" /></template>
    <template v-if="$slots.readonly" #readonly><slot name="readonly" /></template>
  </NumberField>
</template>
