<script setup lang="ts">
import { computed, inject, provide, ref } from "vue";
import { useI18n } from "vue-i18n";
import { applicationKey } from "../../app/environment";
import { ErrorBag } from "../errors";
import DateField from "../DateField.vue";
import DateTimeField from "../DateTimeField.vue";
import I18nField from "../I18nField.vue";
import MultiSelectField from "../MultiSelectField.vue";
import NumberField from "../NumberField.vue";
import SelectField from "../SelectField.vue";
import SwitchField from "../SwitchField.vue";
import TextareaField from "../TextareaField.vue";
import TextField from "../TextField.vue";
import type { FieldMessages } from "../validation";
import { activeLocaleKey, type LocaleMode } from "./localeMode";
import RepeatField from "./RepeatField.vue";
import ResourceField from "./ResourceField.vue";
import type { ResourceId, ResourceSource } from "./resources";
import RichTextField from "./RichTextField.vue";
import type { FormSchema, SchemaField } from "./schema";
import { evaluateVisibility } from "./visibility";

/**
 * A form generated from a typed schema (a content type's fields): each field's `kind` picks the control. It generates a form,
 * nothing more: no page, no save; put it in an `EditorPage` and save the value yourself.
 *
 *   <DynamicForm v-model="values" :schema="schema" :locales="['hr', 'en']" :errors="form.errors.all()" :resources="media" />
 *
 * - **Value:** `Record<field key, value>`. A translatable text is `Record<locale, string>`; an image / document is a resource id,
 *   a gallery a list of ids; a collection a list of row values.
 * - **`visible_when`:** a field whose rule does not hold is not shown. It keeps its value, and an error under its key is not shown.
 * - **`errors`:** go-core's field messages (`form.errors.all()`, or the `ErrorBag`), by field key; `images.0.title` reaches a row.
 * - **`localeMode`:** `"perField"` (default) shows a language strip on each translatable field; `"form"` shows one switcher for
 *   the whole form, which switches every translatable field at once.
 */
const props = withDefaults(
  defineProps<{
    schema: FormSchema;
    modelValue?: Record<string, unknown>;
    /** The languages of translatable fields. Default: the application's. */
    locales?: readonly string[];
    /** The language shown first, and the one a required translatable field needs. Default: the first. */
    defaultLocale?: string;
    errors?: FieldMessages | ErrorBag;
    /** Reads the values instead of editing them. */
    readonly?: boolean;
    localeMode?: LocaleMode;
    /** The media library of image, document and gallery fields, and of the picture button of rich text. */
    resources?: ResourceSource;
  }>(),
  { modelValue: () => ({}), locales: undefined, defaultLocale: undefined, errors: () => ({}), readonly: false, localeMode: "perField", resources: undefined },
);
const emit = defineEmits<{ "update:modelValue": [values: Record<string, unknown>] }>();

const { t, availableLocales } = useI18n();
const application = inject(applicationKey, null);
const known = computed(() => props.locales ?? application?.locales ?? availableLocales);
const fallback = computed(() => props.defaultLocale ?? known.value[0] ?? "");

const messages = computed<FieldMessages>(() => (props.errors instanceof ErrorBag ? props.errors.all() : props.errors));
/** The first message under the key itself, else under a path inside it (`title.hr`). */
function errorOf(key: string): string | undefined {
  const exact = messages.value[key]?.[0];
  if (exact !== undefined) return exact;
  const inside = Object.keys(messages.value).find((path) => path.startsWith(`${key}.`));
  return inside === undefined ? undefined : messages.value[inside]?.[0];
}
const inside = (key: string): FieldMessages => Object.fromEntries(Object.entries(messages.value).filter(([path]) => path.startsWith(`${key}.`)).map(([path, list]) => [path.slice(key.length + 1), list]));

const visible = computed(() => props.schema.fields.filter((field) => evaluateVisibility(field.visible_when, props.modelValue)));

function set(key: string, value: unknown) {
  emit("update:modelValue", { ...props.modelValue, [key]: value });
}

const translated = (field: SchemaField) => !!field.translatable && (field.kind === "text" || field.kind === "textarea" || field.kind === "rich_text");
// A translatable rich text has no strip of its own (I18nField is plain text), so it always follows the form's switcher.
const inForm = (field: SchemaField) => translated(field) && (props.localeMode === "form" || field.kind === "rich_text");

// One switcher for the form. A row of a collection in "form" mode follows its parent's instead of showing another.
const parentLocale = inject(activeLocaleKey, null);
const following = computed(() => props.localeMode === "form" && parentLocale !== null);
const chosen = ref<string | null>(null);
const active = computed(() => (following.value && parentLocale ? parentLocale.value : chosen.value !== null && known.value.includes(chosen.value) ? chosen.value : fallback.value));
const ownSwitcher = computed(() => !following.value && visible.value.some(inForm));
provide(activeLocaleKey, active);
const textOf = (field: SchemaField): Record<string, string> => (typeof props.modelValue[field.key] === "object" && props.modelValue[field.key] !== null ? (props.modelValue[field.key] as Record<string, string>) : {});
const localeError = (field: SchemaField) => messages.value[`${field.key}.${active.value}`]?.[0] ?? messages.value[field.key]?.[0];
const hasErrorIn = (locale: string) => visible.value.some((field) => translated(field) && messages.value[`${field.key}.${locale}`] !== undefined);
function setText(field: SchemaField, locale: string, text: string) {
  set(field.key, { ...textOf(field), [locale]: text });
}

const common = (field: SchemaField, path = field.key) => ({
  label: field.label,
  hint: field.props?.hint,
  required: field.required === true,
  error: field.kind === 'collection' ? messages.value[field.key]?.[0] : errorOf(field.key),
  editable: !props.readonly,
  name: field.key,
  "data-field-key": path,
});
const hasRule = (field: SchemaField, rule: string) => field.validation?.some((each) => each.rule === rule) === true;
const maxLength = (field: SchemaField): number | undefined => {
  const max = field.validation?.find((each) => each.rule === "max")?.args?.[0];
  return typeof max === "number" ? max : undefined;
};
const idsOf = (field: SchemaField): ResourceId[] => (Array.isArray(props.modelValue[field.key]) ? (props.modelValue[field.key] as ResourceId[]) : []);
const numberOf = (field: SchemaField): number | null => (typeof props.modelValue[field.key] === "number" ? (props.modelValue[field.key] as number) : null);
const stringOf = (field: SchemaField): string | null => (typeof props.modelValue[field.key] === "string" && props.modelValue[field.key] !== "" ? (props.modelValue[field.key] as string) : null);
const choiceOf = (field: SchemaField): string | number | null => {
  const value = props.modelValue[field.key];
  return typeof value === "string" || typeof value === "number" ? value : null;
};
const choicesOf = (field: SchemaField): (string | number)[] => (Array.isArray(props.modelValue[field.key]) ? (props.modelValue[field.key] as (string | number)[]) : []);
const rowsOf = (field: SchemaField): Record<string, unknown>[] => (Array.isArray(props.modelValue[field.key]) ? (props.modelValue[field.key] as Record<string, unknown>[]) : []);
const plainText = (field: SchemaField): string => (typeof props.modelValue[field.key] === "string" ? (props.modelValue[field.key] as string) : "");
</script>

<template>
  <div class="flex w-full flex-col gap-4" data-dynamic-form>
    <div v-if="ownSwitcher" role="tablist" :aria-label="t('core.form.dynamic.language')" class="flex gap-1">
      <button v-for="locale in known" :id="`dynamic-locale-${locale}`" :key="locale" type="button" role="tab" :aria-selected="locale === active" :data-locale="locale" :data-error="hasErrorIn(locale) || undefined"
        class="rounded-md px-3 py-1 text-sm font-medium uppercase aria-selected:bg-surface-muted data-[error]:text-critical" @click="chosen = locale">{{ locale }}</button>
    </div>
    <template v-for="field in visible" :key="field.key">
      <!-- text kinds -->
      <template v-if="translated(field)">
        <template v-if="inForm(field)">
          <RichTextField v-if="field.kind === 'rich_text'" v-bind="common(field)" :error="localeError(field)" :model-value="textOf(field)[active] ?? ''" :images="props.resources" :video="field.props?.video" @update:model-value="setText(field, active, $event)" />
          <TextareaField v-else-if="field.kind === 'textarea'" v-bind="common(field)" :error="localeError(field)" :model-value="textOf(field)[active] ?? ''" :rows="field.props?.rows" :placeholder="field.props?.placeholder" :max-length="maxLength(field)" @update:model-value="setText(field, active, $event)" />
          <TextField v-else v-bind="common(field)" :error="localeError(field)" :model-value="textOf(field)[active] ?? ''" :placeholder="field.props?.placeholder" :max-length="maxLength(field)" @update:model-value="setText(field, active, $event)" />
        </template>
        <I18nField v-else v-bind="common(field)" :model-value="textOf(field)" :locales="known" :default-locale="fallback" :required-locales="field.required ? [fallback] : []" :multiline="field.kind === 'textarea'" :rows="field.props?.rows" :placeholder="field.props?.placeholder" :max-length="maxLength(field)" @update:model-value="set(field.key, $event)" />
      </template>
      <TextField v-else-if="field.kind === 'text'" v-bind="common(field)" :type="hasRule(field, 'email') ? 'email' : hasRule(field, 'url') ? 'url' : 'text'" :model-value="plainText(field)" :placeholder="field.props?.placeholder" :max-length="maxLength(field)" @update:model-value="set(field.key, $event)" />
      <TextareaField v-else-if="field.kind === 'textarea'" v-bind="common(field)" :model-value="plainText(field)" :rows="field.props?.rows" :placeholder="field.props?.placeholder" :max-length="maxLength(field)" @update:model-value="set(field.key, $event)" />
      <RichTextField v-else-if="field.kind === 'rich_text'" v-bind="common(field)" :model-value="plainText(field)" :images="props.resources" :video="field.props?.video" @update:model-value="set(field.key, $event)" />
      <NumberField v-else-if="field.kind === 'number'" v-bind="common(field)" :model-value="numberOf(field)" :placeholder="field.props?.placeholder" @update:model-value="set(field.key, $event)" />
      <SwitchField v-else-if="field.kind === 'boolean'" v-bind="common(field)" :model-value="props.modelValue[field.key] === true" @update:model-value="set(field.key, $event)" />
      <SelectField v-else-if="field.kind === 'select'" v-bind="common(field)" :options="field.options ?? []" :model-value="choiceOf(field)" :clearable="!field.required" :placeholder="field.props?.placeholder" @update:model-value="set(field.key, $event)" />
      <MultiSelectField v-else-if="field.kind === 'multi_select'" v-bind="common(field)" :options="field.options ?? []" :model-value="choicesOf(field)" :placeholder="field.props?.placeholder" @update:model-value="set(field.key, $event)" />
      <DateField v-else-if="field.kind === 'date'" v-bind="common(field)" :model-value="stringOf(field)" @update:model-value="set(field.key, $event)" />
      <DateTimeField v-else-if="field.kind === 'datetime'" v-bind="common(field)" :model-value="stringOf(field)" @update:model-value="set(field.key, $event)" />
      <template v-else-if="field.kind === 'image' || field.kind === 'document' || field.kind === 'gallery'">
        <ResourceField v-if="props.resources" v-bind="common(field)" :source="props.resources" :multiple="field.kind === 'gallery'" :accept="field.props?.accept ?? (field.kind === 'image' ? 'image/*' : undefined)" :model-value="field.kind === 'gallery' ? idsOf(field) : (props.modelValue[field.key] as ResourceId | null | undefined)" @update:model-value="set(field.key, $event)" />
      </template>
      <RepeatField v-else-if="field.kind === 'collection'" v-bind="common(field)" :fields="field.children ?? []" :model-value="rowsOf(field)" :locales="known" :default-locale="fallback" :errors="inside(field.key)" :resources="props.resources" :add-label="field.props?.addLabel" :locale-mode="props.localeMode" @update:model-value="set(field.key, $event)" />
    </template>
  </div>
</template>
