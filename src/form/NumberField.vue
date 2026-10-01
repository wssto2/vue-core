<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue";
import { controlWidth, type ControlWidth } from "../controls";
import { useFormat } from "../format";
import { useControlSurface } from "./control";
import Field from "./Field.vue";
import { fieldDefaults, fieldProps, useFormGroup, type FieldProps } from "./field";
import { numberMarks, parseNumber } from "./number";

/**
 * A number. Empty is `null`; the text is read as the user's locale writes numbers (and forgives the
 * other decimal mark), rounded to `decimals`, shown with grouping when the field is not being edited.
 *
 *   <NumberField v-bind="form.bind('quantity')" :label="t('quantity')" suffix="pcs" />
 *   <NumberField v-bind="form.bind('weight')" :decimals="2" suffix="kg" />
 *
 * `:grouping="false"` writes no thousands separator, shown or typed (a year 2024, a coordinate 45.815123), and then a "."
 * is always a decimal mark, never a group mark.
 *
 * Typing "1,5" mid-edit is never rewritten under the cursor: the text is the user's until the field loses focus.
 * Limits (`min`, `max`) are the validator's job; the field only keeps what cannot be a number out.
 */
const props = withDefaults(
  defineProps<FieldProps & {
    decimals?: number;
    /** Allows a leading minus sign. */
    negative?: boolean;
    /** Separates thousands ("1.234.567"); off for years, coordinates and codes. */
    grouping?: boolean;
    placeholder?: string;
    prefix?: string;
    suffix?: string;
    /** sm 10rem (the default for numbers) · md · lg · full. */
    width?: Exclude<ControlWidth, "content">;
  }>(),
  { ...fieldDefaults, decimals: 0, negative: false, grouping: true, placeholder: undefined, prefix: undefined, suffix: undefined, width: "sm" },
);

const model = defineModel<number | null>({ default: null });
const format = useFormat();
const input = useTemplateRef<HTMLInputElement>("input");
const inRow = !!useFormGroup();
const surface = useControlSurface("text", () => (props.error ? "error" : props.disabled ? "locked" : "rest"));
const fieldWidth = computed(() => (inRow ? controlWidth(props.width) : "w-full"));

const marks = computed(() => numberMarks(format));
const shown = (value: number | null) => (value === null ? "" : format.number(value, { minimumFractionDigits: props.decimals, maximumFractionDigits: props.decimals, useGrouping: props.grouping }));
const editing = (value: number | null) => (value === null ? "" : String(value).replace(".", marks.value.decimal));
const read = (text: string) => parseNumber(text, { decimals: props.decimals, group: props.grouping ? marks.value.group : "" });

const focused = ref(false);
const text = ref(shown(model.value));
watch(model, (value) => {
  // What the user typed stays while they type; any other change (a reset, a hydrate) replaces the text.
  if (!focused.value) text.value = shown(value);
  else if (read(text.value) !== value) text.value = editing(value);
});
watch(() => [props.decimals, props.grouping, marks.value.decimal], () => {
  if (!focused.value) text.value = shown(model.value);
});

function onInput(event: Event) {
  const element = event.target as HTMLInputElement;
  let next = element.value.replace(/[^\d.,\-\s]/g, "");
  if (!props.negative) next = next.replace(/-/g, "");
  else next = next.replace(/(?!^)-/g, "");
  if (next !== element.value) element.value = next;
  text.value = next;
  const parsed = read(next);
  if (parsed !== undefined) model.value = parsed;
  else model.value = null;
}

function onFocus() {
  focused.value = true;
  text.value = editing(model.value);
}

function onBlur() {
  focused.value = false;
  text.value = shown(model.value);
}

defineExpose({ focus: () => input.value?.focus() });
</script>

<template>
  <Field v-slot="{ id, describedby, invalid }" v-bind="fieldProps(props)" :value="model === null ? null : shown(model)" :prefix="props.prefix" :suffix="props.suffix" value-style="numeric">
    <div class="flex items-center gap-1.5" :class="[surface, fieldWidth]">
      <span v-if="props.prefix" class="shrink-0 text-footnote text-content-muted">{{ props.prefix }}</span>
      <input :id="id" ref="input" :value="text" type="text" inputmode="decimal" autocomplete="off" :name="props.name" :placeholder="props.placeholder" :disabled="props.disabled" :required="props.required"
        :aria-required="props.required || undefined" :aria-invalid="invalid || undefined" :aria-describedby="describedby"
        class="block w-full min-w-0 border-0 bg-transparent px-0 py-1 text-right text-body tabular-nums text-content-strong placeholder:text-content-disabled focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
        @input="onInput" @focus="onFocus" @blur="onBlur" />
      <span v-if="props.suffix" class="shrink-0 text-footnote text-content-muted">{{ props.suffix }}</span>
    </div>
  </Field>
</template>
