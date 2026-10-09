<script setup lang="ts" generic="Value extends string | number">
import { computed } from "vue";
import { Icon, type IconName } from "../icon";
import Field from "./Field.vue";
import { fieldDefaults, fieldProps, useFieldMode, type FieldProps, type FieldSlots } from "./field";
import type { SelectOption } from "./options";

/**
 * One choice shown as large cards, each with an optional icon and a description: a way of doing something, a
 * plan, a method. A real group of radio buttons underneath (arrow keys move, the name is the label).
 *
 *   <CardSelectField v-bind="form.bind('entry')" :label="t('entry')" :options="[{ value: 'vin', label: 'By VIN', description: 'Fastest', icon: 'search' }]" />
 */
const props = withDefaults(
  defineProps<FieldProps & {
    modelValue?: Value | null;
    options: readonly (SelectOption<Value> & { readonly icon?: IconName })[];
    /** Cards per row (1 to 4). */
    columns?: 1 | 2 | 3 | 4;
  }>(),
  { ...fieldDefaults, modelValue: null, columns: 2 },
);

const emit = defineEmits<{ "update:modelValue": [value: Value] }>();
const { editable } = useFieldMode(props);
// Written out so Tailwind generates every class.
const COLUMNS = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" } as const;
const grid = computed(() => COLUMNS[props.columns]);
defineSlots<FieldSlots>();
</script>

<template>
  <Field v-bind="fieldProps(props)" :value="props.options.find((option) => option.value === props.modelValue)?.label ?? null" row-layout="stacked">
    <template #default="{ id, describedby, invalid }">
      <div :id="id" role="radiogroup" :aria-label="props.label" :aria-describedby="describedby" :aria-invalid="invalid || undefined" class="grid w-full gap-2.5" :class="grid" data-test="card-select">
        <label v-for="option in props.options" :key="option.value"
          class="relative flex items-center gap-3 rounded-group bg-fill p-3.5 transition-colors duration-motion-fast focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-border-focus"
          :class="[option.value === props.modelValue ? 'bg-tint-soft ring-[1.5px] ring-inset ring-border-selected' : 'hover:bg-fill-strong', props.disabled || !editable || option.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer']">
          <input type="radio" class="sr-only" :name="props.name ?? id" :value="option.value" :checked="option.value === props.modelValue" :disabled="props.disabled || !editable || option.disabled" @change="emit('update:modelValue', option.value)" />
          <span v-if="option.icon" class="flex size-9 shrink-0 items-center justify-center rounded-control" :class="option.value === props.modelValue ? 'bg-control-on text-white' : 'bg-fill-strong text-content-muted'">
            <Icon :name="option.icon" :size="18" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-body font-semibold text-content-strong">{{ option.label }}</span>
            <span v-if="option.description" class="mt-0.5 block text-footnote text-content-muted">{{ option.description }}</span>
          </span>
          <span v-if="option.value === props.modelValue" class="flex size-5 shrink-0 items-center justify-center rounded-full bg-control-on text-white" aria-hidden="true"><Icon name="checkCustom" :size="12" /></span>
        </label>
      </div>
    </template>
    <template v-if="$slots.trailing" #trailing><slot name="trailing" /></template>
    <template v-if="$slots.labelTrailing" #labelTrailing><slot name="labelTrailing" /></template>
    <template v-if="$slots.readonly" #readonly><slot name="readonly" /></template>
  </Field>
</template>
