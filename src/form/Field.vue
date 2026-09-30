<script setup lang="ts">
import { computed, onBeforeUnmount, useAttrs, useId, useSlots } from "vue";
import { useI18n } from "vue-i18n";
import { Icon } from "../icon";
import FormRow from "./FormRow.vue";
import { fieldDefaults, useFieldMode, useFormGroup, type FieldProps, type FormRowLayout } from "./field";

/**
 * One labelled field: the label, the control in its slot, a hint, the error. Every field component
 * (`TextField`, `SelectField`, …) is this around a control; use it directly to build one of your own.
 *
 * Inside a `FormGroup` it is a grouped row: a label column and the control when editable, a muted label
 * and a trailing value when the form reads. Outside a group it is a plain stacked field. It tells the
 * control what to put on the input (`id`, `describedby`, `invalid`) and marks itself for the page
 * (`data-field-error`, `data-field-required`, `data-field-filled`) so a long form can count errors and
 * required fields without knowing what is inside.
 *
 *   <Field v-slot="{ id, describedby, invalid }" label="Weight" :error="error">
 *     <input :id="id" :aria-describedby="describedby" :aria-invalid="invalid" />
 *   </Field>
 */
const props = withDefaults(
  defineProps<
    FieldProps & {
      /** What read mode shows. `null` or empty reads as "not entered". */
      value?: string | number | boolean | null;
      /** Text before and after the read-mode value (a unit, a currency). */
      prefix?: string;
      suffix?: string;
      /** Read-mode typography: `mono` for codes, `numeric` for tabular figures. */
      valueStyle?: "mono" | "numeric";
      /** See `FormRow`: how the row lays out (a switch is a `setting`, a textarea `stacked`). */
      rowLayout?: Exclude<FormRowLayout, "value">;
      /** `top` aligns the label with the first line of a tall control. */
      rowLabelAlign?: "center" | "top";
    }
  >(),
  { ...fieldDefaults, value: undefined, prefix: undefined, suffix: undefined, valueStyle: undefined, rowLayout: "entry", rowLabelAlign: "center" },
);

defineSlots<{
  default?: (scope: { id: string; describedby: string | undefined; invalid: boolean; required: boolean; disabled: boolean }) => unknown;
  /** A custom read-only presentation (a picked record's card) when `value` is not enough. */
  readonly?: () => unknown;
  /** A row action after the control (a per-row Save). */
  trailing?: () => unknown;
}>();

const { t } = useI18n();
const slots = useSlots();
const attrs = useAttrs();
const group = useFormGroup();
const { editable, locked } = useFieldMode(props);
const id = useId();
const controlId = computed(() => props.name ?? id);
const hintId = computed(() => `${controlId.value}-hint`);
const errorId = computed(() => `${controlId.value}-error`);

// The field tells its group its key and lock whatever its mode: a record's read page names the group a field is in.
if (group?.registerField) {
  const key = attrs["data-field-key"];
  const release = group.registerField(typeof key === "string" ? key : undefined, computed(() => props.disabled));
  onBeforeUnmount(release);
}

const hasValue = computed(() => {
  const value = props.value;
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  return true; // a boolean: `false` is a real value
});
const shown = computed(() => (typeof props.value === "boolean" ? (props.value ? t("core.form.yes") : t("core.form.no")) : props.value));
const hiddenInGroup = computed(() => !!group && !editable.value && group.hideEmpty.value && !hasValue.value && !slots.readonly);

const describedby = computed(() => [props.hint && editable.value ? hintId.value : null, props.error ? errorId.value : null].filter(Boolean).join(" ") || undefined);
const row = computed(() => (editable.value ? props.rowLayout : props.rowLayout === "stacked" ? "stacked" : "value"));
const progress = computed(() =>
  editable.value && !locked.value && props.required ? { "data-field-required": "true", "data-field-filled": hasValue.value ? "true" : undefined } : {},
);
</script>

<template>
  <FormRow v-if="group && !hiddenInGroup" v-bind="progress" :label="props.label" :for="editable ? controlId : undefined" :sub="editable ? props.hint : undefined"
    :sub-id="hintId" :required="editable && !locked && props.required" :layout="row" :label-align="row === 'entry' ? props.rowLabelAlign : undefined"
    :error="props.error" :error-id="errorId" :data-field-locked="locked ? 'true' : undefined">
    <div class="relative w-full min-w-0" :title="locked ? props.lockedReason : undefined">
      <div :class="editable ? (row === 'setting' ? 'flex min-w-0 flex-col items-end' : row === 'stacked' ? 'flex min-w-0 flex-col items-stretch' : 'flex min-w-0 flex-col items-start compact:items-end') : ''">
        <slot v-if="editable" :id="controlId" :describedby="describedby" :invalid="!!props.error" :required="props.required" :disabled="props.disabled" />
        <slot v-else-if="slots.readonly" name="readonly" />
        <span v-else-if="hasValue" class="block break-words text-body text-content-strong" :class="props.valueStyle === 'mono' ? 'font-mono' : props.valueStyle === 'numeric' ? 'tabular-nums' : ''">
          <span v-if="props.prefix" class="mr-1">{{ props.prefix }}</span>{{ shown }}<span v-if="props.suffix" class="ml-1 text-content-muted">{{ props.suffix }}</span>
        </span>
        <span v-else class="block text-body text-content-disabled">{{ t("core.state.no_value") }}</span>
      </div>
    </div>
    <span v-if="locked && props.lockedReason" class="sr-only">{{ props.lockedReason }}</span>
    <template v-if="editable && slots.trailing" #trailing><slot name="trailing" /></template>
  </FormRow>

  <div v-else-if="!group" v-bind="progress" :data-field-error="props.error ? 'true' : undefined" class="flex min-w-0 flex-col gap-1">
    <label v-if="props.label" :for="editable ? controlId : undefined" class="text-footnote font-medium text-content-muted">
      {{ props.label }}<span v-if="editable && props.required" class="text-content-destructive" aria-hidden="true"> *</span>
    </label>
    <slot v-if="editable" :id="controlId" :describedby="describedby" :invalid="!!props.error" :required="props.required" :disabled="props.disabled" />
    <slot v-else-if="slots.readonly" name="readonly" />
    <span v-else class="text-body" :class="hasValue ? 'text-content-strong' : 'text-content-disabled'">{{ hasValue ? `${props.prefix ?? ""}${shown}${props.suffix ?? ""}` : t("core.state.no_value") }}</span>
    <p v-if="props.hint && editable" :id="hintId" class="text-footnote text-content-muted">{{ props.hint }}</p>
    <p v-if="props.error" :id="errorId" role="alert" class="flex items-start gap-1.5 text-footnote text-content-destructive">
      <Icon name="alertTriangle" :size="14" class="mt-px shrink-0" /> {{ props.error }}
    </p>
  </div>
</template>
