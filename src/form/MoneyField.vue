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
  defineProps<FieldProps & { currency: string; decimals?: number; negative?: boolean; width?: Exclude<ControlWidth, "content"> }>(),
  { ...fieldDefaults, decimals: 2, negative: false, width: "sm" },
);

const model = defineModel<number | null>({ default: null });
const emit = defineEmits<{ focus: [event: FocusEvent]; blur: [event: FocusEvent] }>();
const field = useTemplateRef<InstanceType<typeof NumberField>>("field");
defineExpose({ focus: () => field.value?.focus() });
defineSlots<FieldSlots>();
</script>

<template>
  <NumberField ref="field" v-model="model" v-bind="fieldProps(props)" :decimals="props.decimals" :negative="props.negative" :suffix="props.currency" :width="props.width" @focus="emit('focus', $event)" @blur="emit('blur', $event)">
    <template v-if="$slots.trailing" #trailing><slot name="trailing" /></template>
    <template v-if="$slots.labelTrailing" #labelTrailing><slot name="labelTrailing" /></template>
    <template v-if="$slots.readonly" #readonly><slot name="readonly" /></template>
  </NumberField>
</template>
