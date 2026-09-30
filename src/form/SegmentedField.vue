<script setup lang="ts" generic="Value extends string | number">
import { useFormGroup, fieldDefaults, fieldProps, useFieldMode, type FieldProps } from "./field";
import Field from "./Field.vue";
import type { SelectOption } from "./options";

/**
 * A few mutually exclusive choices, all visible: a segmented control. Options may carry a `count` (a scope with its
 * number of items). One is always chosen once the user picks; the value is `null` before that.
 *
 *   <SegmentedField v-bind="form.bind('channel')" :label="t('channel')" :options="[{ value: 'mail', label: 'Mail' }, { value: 'phone', label: 'Phone' }]" />
 *
 * More than a handful, or long labels, belong in a `SelectField`.
 */
const props = withDefaults(
  defineProps<FieldProps & {
    modelValue?: Value | null;
    options: readonly (SelectOption<Value> & { readonly count?: number })[];
    /** `setting` puts the control at the end of the row; `stacked` stretches the segments under the label. */
    rowLayout?: "setting" | "stacked";
  }>(),
  { ...fieldDefaults, modelValue: null, rowLayout: "setting" },
);

// The value is what the field was given, or null before the user picks: it never emits null, so a form field that is never null binds.
const emit = defineEmits<{ "update:modelValue": [value: Value] }>();
const { editable } = useFieldMode(props);
const inRow = !!useFormGroup();

const selected = () => props.options.find((option) => option.value === props.modelValue)?.label ?? null;
</script>

<template>
  <Field v-slot="{ id, describedby, invalid }" v-bind="fieldProps(props)" :value="selected()" :row-layout="props.rowLayout">
    <div :id="id" role="group" :aria-label="props.label" :aria-describedby="describedby" :aria-invalid="invalid || undefined" data-test="segmented"
      class="max-w-full flex-wrap rounded-control bg-fill p-0.5" :class="[inRow && props.rowLayout === 'stacked' ? 'flex w-full' : 'inline-flex', props.disabled ? 'opacity-45' : '']">
      <button v-for="option in props.options" :key="option.value" type="button" :disabled="props.disabled || !editable || option.disabled" :aria-pressed="option.value === props.modelValue"
        class="relative min-h-7 min-w-fit flex-1 whitespace-nowrap rounded-control px-3.5 py-1 text-sm transition-colors duration-motion-fast ease-motion-standard focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus"
        :class="option.value === props.modelValue ? 'bg-segment-selected font-semibold text-content-strong shadow-sm' : 'cursor-pointer font-medium text-content hover:text-content-strong'"
        @click="emit('update:modelValue', option.value)">
        {{ option.label }}
        <span v-if="option.count !== undefined" class="ml-1.5 rounded-full px-1.5 text-caption font-semibold tabular-nums" :class="option.value === props.modelValue ? 'bg-tint-soft text-content-link' : 'bg-fill-strong text-content-muted'">{{ option.count }}</span>
      </button>
    </div>
  </Field>
</template>
