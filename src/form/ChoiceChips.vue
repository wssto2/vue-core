<script setup lang="ts" generic="Value extends string | number">
import { Icon } from "../icon";
import Field from "./Field.vue";
import { fieldDefaults, fieldProps, type FieldProps } from "./field";
import type { SelectOption } from "./options";

/**
 * A small set of independent on/off choices shown all at once as toggle chips (payment methods, condition items). The
 * value is the chosen values; a chip is a button with `aria-pressed`. For a long or searchable list use `MultiSelectField`.
 *
 *   <ChoiceChips v-bind="form.bind('payment')" :label="t('payment')" :options="methods" />
 */
const props = withDefaults(defineProps<FieldProps & { options: readonly SelectOption<Value>[] }>(), { ...fieldDefaults });

const model = defineModel<Value[]>({ default: () => [] });
const toggle = (value: Value) => (model.value = model.value.includes(value) ? model.value.filter((each) => each !== value) : [...model.value, value]);
</script>

<template>
  <Field v-slot="{ id, describedby, invalid }" v-bind="fieldProps(props)" :value="props.options.filter((option) => model.includes(option.value)).map((option) => option.label).join(', ') || null" row-layout="stacked">
    <span v-if="props.options.length === 0" class="text-body text-content-muted">—</span>
    <div v-else :id="id" role="group" :aria-label="props.label" :aria-describedby="describedby" :aria-invalid="invalid || undefined" class="flex flex-wrap gap-1.5 py-1" data-test="choice-chips">
      <button v-for="option in props.options" :key="option.value" type="button" :aria-pressed="model.includes(option.value)" :disabled="props.disabled || option.disabled"
        class="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-subheadline transition-colors duration-motion-fast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:cursor-not-allowed disabled:opacity-60"
        :class="model.includes(option.value) ? 'bg-tint-soft font-semibold text-content-link' : 'bg-fill font-medium text-content-strong hover:bg-fill-strong'" @click="toggle(option.value)">
        <Icon v-if="model.includes(option.value)" name="checkCustom" :size="12" />
        {{ option.label }}
      </button>
    </div>
  </Field>
</template>
