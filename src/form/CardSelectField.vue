<script setup lang="ts" generic="Value extends string | number">
import { computed } from "vue";
import { Icon, type IconName } from "../icon";
import Field from "./Field.vue";
import { fieldDefaults, fieldProps, useFieldMode, type FieldProps } from "./field";
import type { SelectOption } from "./options";

/**
 * One choice shown as large cards, each with an optional icon and a description: a way of doing something, a
 * plan, a method. A real group of radio buttons underneath (arrow keys move, the name is the label).
 *
 *   <CardSelectField v-bind="form.bind('entry')" :label="t('entry')" :options="[{ value: 'vin', label: 'By VIN', description: 'Fastest', icon: 'search' }]" />
 */
const props = withDefaults(
  defineProps<FieldProps & {
    options: readonly (SelectOption<Value> & { readonly icon?: IconName })[];
    /** Cards per row (1 to 4). */
    columns?: 1 | 2 | 3 | 4;
  }>(),
  { ...fieldDefaults, columns: 2 },
);

const model = defineModel<Value | null>({ default: null });
const { editable } = useFieldMode(props);
// Written out so Tailwind generates every class.
const COLUMNS = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" } as const;
const grid = computed(() => COLUMNS[props.columns]);
</script>

<template>
  <Field v-slot="{ id, describedby, invalid }" v-bind="fieldProps(props)" :value="props.options.find((option) => option.value === model)?.label ?? null" row-layout="stacked">
    <div :id="id" role="radiogroup" :aria-label="props.label" :aria-describedby="describedby" :aria-invalid="invalid || undefined" class="grid w-full gap-2.5" :class="grid" data-test="card-select">
      <label v-for="option in props.options" :key="option.value"
        class="relative flex items-center gap-3 rounded-group bg-fill p-3.5 transition-colors duration-motion-fast focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-border-focus"
        :class="[option.value === model ? 'bg-tint-soft ring-[1.5px] ring-inset ring-border-selected' : 'hover:bg-fill-strong', props.disabled || !editable || option.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer']">
        <input type="radio" class="sr-only" :name="props.name ?? id" :value="option.value" :checked="option.value === model" :disabled="props.disabled || !editable || option.disabled" @change="model = option.value" />
        <span v-if="option.icon" class="flex size-9 shrink-0 items-center justify-center rounded-control" :class="option.value === model ? 'bg-control-on text-white' : 'bg-fill-strong text-content-muted'">
          <Icon :name="option.icon" :size="18" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-body font-semibold text-content-strong">{{ option.label }}</span>
          <span v-if="option.description" class="mt-0.5 block text-footnote text-content-muted">{{ option.description }}</span>
        </span>
        <span v-if="option.value === model" class="flex size-5 shrink-0 items-center justify-center rounded-full bg-control-on text-white" aria-hidden="true"><Icon name="checkCustom" :size="12" /></span>
      </label>
    </div>
  </Field>
</template>
