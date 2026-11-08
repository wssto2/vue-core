<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import Button from "../../button/Button.vue";
import { Icon } from "../../icon";
import FormGroup from "../FormGroup.vue";
import FormRow from "../FormRow.vue";
import { fieldDefaults, useFieldMode, type FieldProps } from "../field";
import type { FieldMessages } from "../validation";
import DynamicForm from "./DynamicForm.vue";
import type { LocaleMode } from "./localeMode";
import type { ResourceSource } from "./resources";
import type { SchemaField } from "./schema";

/**
 * A repeatable group: rows the user adds, removes and moves, each a grouped card (header "Row 1" with move and delete icon buttons, its fields as rows,
 * an add row at the end), a `DynamicForm` over `fields`. The value is the list of the
 * rows' values. Errors of the rows arrive in the form's paths relative to this field (`0.title` is the first row's title).
 *
 *   <RepeatField v-model="form.slides" :fields="slideFields" label="Slides" />
 */
const props = withDefaults(
  defineProps<FieldProps & {
    /** The fields of each row. */
    fields: readonly SchemaField[];
    modelValue?: readonly Record<string, unknown>[];
    locales?: readonly string[];
    defaultLocale?: string;
    /** Messages by path inside this field: `"0.title"`. */
    errors?: FieldMessages;
    resources?: ResourceSource;
    addLabel?: string;
    localeMode?: LocaleMode;
  }>(),
  { ...fieldDefaults, modelValue: () => [], locales: undefined, defaultLocale: undefined, errors: () => ({}), resources: undefined, addLabel: undefined, localeMode: "perField" },
);
const emit = defineEmits<{ "update:modelValue": [rows: Record<string, unknown>[]] }>();

const { t } = useI18n();
const { editable } = useFieldMode(props);

// A row keeps its key while its neighbours move, so a field being typed in does not remount.
let counter = 0;
const keys = ref<number[]>([]);
watch(() => props.modelValue.length, (length) => {
  while (keys.value.length < length) keys.value.push(counter++);
  keys.value.length = length;
}, { immediate: true });

const commit = (rows: Record<string, unknown>[]) => emit("update:modelValue", rows);
const add = () => {
  keys.value.push(counter++);
  commit([...props.modelValue, {}]);
};
const remove = (index: number) => {
  keys.value.splice(index, 1);
  commit(props.modelValue.filter((_, at) => at !== index));
};
function move(index: number, by: -1 | 1) {
  const target = index + by;
  if (target < 0 || target >= props.modelValue.length) return;
  const rows = [...props.modelValue];
  [rows[index], rows[target]] = [rows[target]!, rows[index]!];
  [keys.value[index], keys.value[target]] = [keys.value[target]!, keys.value[index]!];
  commit(rows);
}
const edit = (index: number, row: Record<string, unknown>) => commit(props.modelValue.map((each, at) => (at === index ? row : { ...each })));

function rowErrors(index: number): FieldMessages {
  const prefix = `${index}.`;
  return Object.fromEntries(Object.entries(props.errors).filter(([path]) => path.startsWith(prefix)).map(([path, list]) => [path.slice(prefix.length), list]));
}
</script>

<template>
  <section v-if="props.label || props.modelValue.length > 0 || editable" class="flex min-w-0 flex-col gap-group-gap" data-repeat :data-field-error="props.error ?? props.errors[''] ? 'true' : undefined" :aria-label="props.label">
    <div v-if="props.label || props.hint" class="px-row-inset">
      <h3 v-if="props.label" class="text-subheadline font-semibold text-content-strong compact:text-footnote compact:font-normal compact:uppercase compact:tracking-wide compact:text-content-muted">
        {{ props.label }}<span v-if="editable && props.required" class="text-content-destructive" aria-hidden="true"> *</span>
      </h3>
      <p v-if="props.hint && editable" class="text-footnote text-content-muted text-pretty">{{ props.hint }}</p>
      <p v-if="props.error ?? props.errors['']?.[0]" role="alert" class="mt-1 flex items-start gap-1.5 text-footnote text-content-destructive">
        <Icon name="alertTriangle" :size="14" class="mt-px shrink-0" /> {{ props.error ?? props.errors[""]?.[0] }}
      </p>
    </div>
    <FormGroup v-for="(row, index) in props.modelValue" :key="keys[index]" :header="t('core.form.dynamic.repeat.row', { n: index + 1 })" data-repeat-row>
      <template v-if="editable && !props.disabled" #header-trailing>
        <div class="flex gap-1">
          <Button size="xs" prominence="plain" icon="arrowUpSLine" :disabled="index === 0" v-bind="{ 'aria-label': t('core.form.dynamic.repeat.up', { n: index + 1 }) }" data-move="up" @click="move(index, -1)" />
          <Button size="xs" prominence="plain" icon="arrowDownSLine" :disabled="index === props.modelValue.length - 1" v-bind="{ 'aria-label': t('core.form.dynamic.repeat.down', { n: index + 1 }) }" data-move="down" @click="move(index, 1)" />
          <Button size="xs" prominence="plain" tone="critical" icon="deleteBin2Line" v-bind="{ 'aria-label': t('core.form.dynamic.repeat.remove', { n: index + 1 }) }" data-remove @click="remove(index)" />
        </div>
      </template>
      <DynamicForm :schema="{ fields: props.fields }" :model-value="row" :locales="props.locales" :default-locale="props.defaultLocale" :errors="rowErrors(index)" :resources="props.resources" :readonly="!editable || props.disabled" :locale-mode="props.localeMode" @update:model-value="edit(index, $event)" />
    </FormGroup>
    <FormGroup v-if="editable && !props.disabled">
      <FormRow layout="stacked">
        <button type="button" data-add class="flex w-full items-center justify-center gap-1.5 py-1 text-body text-content-link focus-visible:outline-2 focus-visible:outline-border-focus" @click="add">
          <Icon name="addLine" :size="18" class="shrink-0" /> {{ props.addLabel ?? t("core.form.dynamic.repeat.add") }}
        </button>
      </FormRow>
    </FormGroup>
  </section>
</template>
