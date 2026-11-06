<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import Button from "../../button/Button.vue";
import Field from "../Field.vue";
import { fieldDefaults, fieldProps, useFieldMode, type FieldProps } from "../field";
import type { FieldMessages } from "../validation";
import DynamicForm from "./DynamicForm.vue";
import type { LocaleMode } from "./localeMode";
import type { ResourceSource } from "./resources";
import type { SchemaField } from "./schema";

/**
 * A repeatable group: rows the user adds, removes and moves, each a `DynamicForm` over `fields`. The value is the list of the
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
  <Field v-bind="fieldProps(props)" row-layout="stacked" :value="null" :error="props.error ?? props.errors['']?.[0]">
    <div class="flex w-full flex-col gap-3">
      <div v-for="(row, index) in props.modelValue" :key="keys[index]" class="rounded-md border border-border p-3" data-repeat-row>
        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm font-medium text-muted">{{ t("core.form.dynamic.repeat.row", { n: index + 1 }) }}</span>
          <div v-if="editable && !props.disabled" class="flex gap-1">
            <Button size="xs" prominence="plain" icon="arrowUpSLine" :disabled="index === 0" v-bind="{ 'aria-label': t('core.form.dynamic.repeat.up', { n: index + 1 }) }" data-move="up" @click="move(index, -1)" />
            <Button size="xs" prominence="plain" icon="arrowDownSLine" :disabled="index === props.modelValue.length - 1" v-bind="{ 'aria-label': t('core.form.dynamic.repeat.down', { n: index + 1 }) }" data-move="down" @click="move(index, 1)" />
            <Button size="xs" prominence="plain" tone="critical" icon="deleteBin2Line" v-bind="{ 'aria-label': t('core.form.dynamic.repeat.remove', { n: index + 1 }) }" data-remove @click="remove(index)" />
          </div>
        </div>
        <DynamicForm :schema="{ fields: props.fields }" :model-value="row" :locales="props.locales" :default-locale="props.defaultLocale" :errors="rowErrors(index)" :resources="props.resources" :readonly="!editable || props.disabled" :locale-mode="props.localeMode" @update:model-value="edit(index, $event)" />
      </div>
      <div v-if="editable && !props.disabled">
        <Button icon="addLine" data-add @click="add">{{ props.addLabel ?? t("core.form.dynamic.repeat.add") }}</Button>
      </div>
    </div>
  </Field>
</template>
