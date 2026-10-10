<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { useCompactPresentation } from "../internal/mediaQuery";
import { useControlSurface } from "./control";
import Field from "./Field.vue";
import { fieldDefaults, fieldProps, useFieldMode, useFormGroup, type FieldProps, type FieldSlots } from "./field";

/**
 * Longer text. On wide screens a labelled textarea is an entry row like the others (the label in the label
 * column, top-aligned, with "n / max" under it when there is a `maxLength`); on phones, and when `stacked`,
 * the label sits above a full-width field.
 *
 *   <TextareaField v-bind="form.bind('note')" :label="t('note')" :max-length="500" :rows="4" />
 */
const props = withDefaults(
  defineProps<FieldProps & {
    placeholder?: string;
    maxLength?: number;
    rows?: number;
    autocomplete?: string;
    /** The label above the field even on wide screens: for a group too narrow for a label column. */
    stacked?: boolean;
  }>(),
  { ...fieldDefaults, placeholder: undefined, maxLength: undefined, rows: 3, autocomplete: undefined, stacked: false },
);

const model = defineModel<string>({ default: "" });
const emit = defineEmits<{ focus: [event: FocusEvent]; blur: [event: FocusEvent] }>();
const area = useTemplateRef<HTMLTextAreaElement>("area");
const inRow = !!useFormGroup();
const compact = useCompactPresentation();
const { editable } = useFieldMode(props);
const asEntry = computed(() => inRow && !props.stacked && !compact.value && editable.value && !!props.label);
const counter = computed(() => (props.maxLength ? `${model.value.length} / ${props.maxLength}` : undefined));
// Entry row: the counter under the label; otherwise it goes under the field.
const hint = computed(() => (asEntry.value && counter.value ? [props.hint, counter.value].filter(Boolean).join(" · ") : props.hint));
const surface = useControlSurface("area", () => (props.error ? "error" : props.disabled ? "locked" : "rest"));

defineExpose({ focus: () => area.value?.focus() });
defineSlots<FieldSlots>();
</script>

<template>
  <Field v-bind="{ ...fieldProps(props), hint }" :value="model" :row-layout="asEntry ? 'entry' : 'stacked'" row-label-align="top">
    <template #default="{ id, describedby, invalid }">
      <div class="w-full" :class="surface">
        <textarea :id="id" ref="area" v-model="model" :name="props.name" :rows="props.rows" :placeholder="props.placeholder" :maxlength="props.maxLength" :autocomplete="props.autocomplete"
          :disabled="props.disabled" :required="props.required" :aria-required="props.required || undefined" :aria-invalid="invalid || undefined" :aria-describedby="describedby"
          class="block w-full border-0 bg-transparent px-0 py-1 text-body text-content-strong placeholder:text-content-disabled focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
          :class="props.disabled ? 'resize-none' : 'resize-y'" @focus="emit('focus', $event)" @blur="emit('blur', $event)"></textarea>
      </div>
      <p v-if="!asEntry && counter" class="mt-1 self-end text-footnote tabular-nums text-content-muted">{{ counter }}</p>
    </template>
    <template v-if="$slots.trailing" #trailing><slot name="trailing" /></template>
    <template v-if="$slots.labelTrailing" #labelTrailing><slot name="labelTrailing" /></template>
    <template v-if="$slots.readonly" #readonly><slot name="readonly" /></template>
  </Field>
</template>
