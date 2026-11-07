<script setup lang="ts">
import { computed, provide, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import Button from "../button/Button.vue";
import { FormErrors, FormGroup, I18nField, NumberField, SelectField, SwitchField, TextField, formEditableKey, useForm, type FormValidator, type I18nText, type ValidationIssue } from "../form";
import Sheet from "../modal/Sheet.vue";
import type { DescriptionResponse, FieldResponse, ItemResponse, LevelResponse } from "../modules/characteristics/entities";
import type { CreateInput, UpdateInput } from "../modules/characteristics/schemas";
import { toast } from "../overlay";
import Banner from "../state/Banner.vue";
import { useCharacteristicsApi } from "./api";
import { fieldsFor, labelIn, type CharacteristicNode } from "./model";

/**
 * One item in a sheet, built from the project's description: the name (per language when the level has translations), the switch, and the
 * level's extra fields for the branch the item is in, each by its type (text, number, yes/no, choice). A read-only field shows locked; the
 * ones the item's branch does not have are not there. Nothing here is specific to a project. `editable` false is the same sheet read.
 * Saving creates (`parent` null for a root) or updates; a changed switch is its own call after it. Opened with `show`.
 */
const props = defineProps<{ description: DescriptionResponse; editable: boolean }>();
const emit = defineEmits<{
  /** After a save: the item as the server stored it, and whether it was new. */
  saved: [item: ItemResponse, created: boolean];
  /** The footer's Delete. */
  remove: [node: CharacteristicNode];
}>();

type Target = { readonly mode: "create"; readonly level: LevelResponse; readonly parent: CharacteristicNode | null } | { readonly mode: "edit"; readonly node: CharacteristicNode; readonly level: LevelResponse };
type Draft = { name: string; names: I18nText; active: boolean; values: Record<string, unknown> };

const { t, locale } = useI18n();
const api = useCharacteristicsApi();
const sheet = useTemplateRef<{ present: () => void; dismiss: () => void }>("sheet");
const target = ref<Target | null>(null);
provide(formEditableKey, computed(() => props.editable));

const languages = computed(() => props.description.languages);
const first = computed(() => languages.value[0] ?? "");
const level = computed(() => target.value?.level ?? null);
/** The items from the root down to the branch the item is in (a new item's parent included): where the fields' branch scopes are read. */
const path = computed<readonly ItemResponse[]>(() => (target.value === null ? [] : target.value.mode === "edit" ? target.value.node.ancestors : target.value.parent ? [...target.value.parent.ancestors, target.value.parent.item] : []));
const fields = computed(() => (level.value ? fieldsFor(level.value, path.value) : []));
const editableFields = computed(() => fields.value.filter((field) => !field.read_only));
const lockedFields = computed(() => fields.value.filter((field) => field.read_only));
const where = computed(() => path.value.map((item) => item.name).join(" › "));
const title = computed(() => (target.value === null ? "" : target.value.mode === "edit" ? target.value.node.item.name : t("core.characteristics.sheet.new_title", { name: labelIn(target.value.level.label, locale.value) })));

const required = () => t("core.validation_errors.required");
const validator: FormValidator<Draft> = {
  safeParse(input) {
    const draft = input as Draft;
    const issues: ValidationIssue[] = [];
    const current = level.value;
    if (current === null) return { success: false, error: { issues } };
    if (current.has_translations) {
      if (draft.names[first.value]?.trim() === "" || draft.names[first.value] === undefined) issues.push({ path: ["names"], message: required() });
      for (const language of languages.value) if ((draft.names[language] ?? "").trim().length > current.name_max) issues.push({ path: ["names"], message: t("core.validation_errors.max", { max: current.name_max }) });
    } else if (draft.name.trim() === "") issues.push({ path: ["name"], message: required() });
    else if (draft.name.trim().length > current.name_max) issues.push({ path: ["name"], message: t("core.validation_errors.max", { max: current.name_max }) });
    for (const field of editableFields.value) {
      const value = draft.values[field.column];
      if (field.type === "text" && field.max > 0 && String(value ?? "").length > field.max) issues.push({ path: ["values", field.column], message: t("core.validation_errors.max", { max: field.max }) });
    }
    return issues.length > 0 ? { success: false, error: { issues } } : { success: true, data: draft };
  },
};

const blank = (field: FieldResponse): unknown => (field.type === "yesno" ? false : field.type === "number" ? null : "");
const form = useForm<Draft>({ defaults: () => ({ name: "", names: {}, active: true, values: {} }), validator });

function open(next: Target) {
  target.value = next;
  const levelFields = fieldsFor(next.level, next.mode === "edit" ? next.node.ancestors : next.parent ? [...next.parent.ancestors, next.parent.item] : []);
  const item = next.mode === "edit" ? next.node.item : null;
  const names: I18nText = {};
  for (const language of languages.value) names[language] = item?.translations?.[language] ?? (language === first.value ? (item?.name ?? "") : "");
  form.hydrate({
    name: item?.name ?? "",
    names,
    active: item?.active ?? true,
    values: Object.fromEntries(levelFields.map((field) => [field.column, item?.values?.[field.column] ?? blank(field)])),
  });
  sheet.value?.present();
}

async function save() {
  const current = target.value;
  if (current === null) return;
  const result = await form.submit(async (draft, { idempotencyKey }) => {
    const name = current.level.has_translations ? (draft.names[first.value] ?? "").trim() || (Object.values(draft.names).find((text) => text.trim() !== "") ?? "").trim() : draft.name.trim();
    const translations = current.level.has_translations ? Object.fromEntries(languages.value.map((language) => [language, (draft.names[language] ?? "").trim()])) : undefined;
    // Read-only fields are never sent: the server refuses a change to them, and the project's code fills them in.
    const values = Object.fromEntries(editableFields.value.map((field) => [field.column, draft.values[field.column]]));
    const body = { name, ...(translations ? { translations } : {}), ...(editableFields.value.length > 0 ? { values } : {}) };
    if (current.mode === "create") {
      return { item: await api.create({ ...body, level: current.level.level, ...(current.parent ? { parent_id: current.parent.item.id } : {}), active: draft.active } as CreateInput, idempotencyKey), created: true };
    }
    const { item: before } = current.node;
    let item = await api.update({ ...body, level: before.level, id: before.id } as UpdateInput, idempotencyKey);
    if (current.level.has_active && draft.active !== before.active) item = await api.setActive(before.level, before.id, draft.active);
    return { item, created: false };
  });
  if (result.status === "saved" || result.status === "saved-refresh-failed") {
    toast.success(t(result.value.created ? "core.characteristics.toasts.created" : "core.characteristics.toasts.saved"));
    emit("saved", result.value.item, result.value.created);
    sheet.value?.dismiss();
  }
}

const binding = (field: FieldResponse) => ({
  modelValue: form.values.values[field.column] as never,
  "onUpdate:modelValue": (value: unknown) => (form.values.values[field.column] = value),
  error: form.errors.first(`values.${field.column}`),
});
const choices = (field: FieldResponse) => field.choices.map((choice) => ({ value: choice.value, label: labelIn(choice.label, locale.value) }));
const labelOf = (field: FieldResponse) => labelIn(field.label, locale.value);

defineExpose({
  /** A new item below `parent` (null: a root of level 1). */
  create: (parent: CharacteristicNode | null) => {
    const next = props.description.levels.find((each) => each.level === (parent ? parent.level + 1 : 1));
    if (next) open({ mode: "create", level: next, parent });
  },
  edit: (node: CharacteristicNode) => {
    const next = props.description.levels.find((each) => each.level === node.level);
    if (next) open({ mode: "edit", node, level: next });
  },
});
</script>

<template>
  <Sheet ref="sheet" size="md" grouped :title="title" @dismissed="target = null">
    <div v-if="target && level" class="flex min-w-0 flex-col gap-group-gap" data-test="characteristic-form">
      <p v-if="where" class="text-footnote text-content-muted" data-test="characteristic-path">{{ where }}</p>
      <FormErrors :form="form" :label="(field: string) => field" />
      <FormGroup>
        <I18nField v-if="level.has_translations" v-bind="form.bind('names')" :label="t('core.characteristics.sheet.name')" :locales="languages" :default-locale="first" :required-locales="[first]" :max-length="level.name_max" required />
        <TextField v-else v-bind="form.bind('name')" :label="t('core.characteristics.sheet.name')" :max-length="level.name_max" required />
        <SwitchField v-if="level.has_active" v-bind="form.bind('active')" :label="t('core.characteristics.sheet.active')" />
      </FormGroup>

      <FormGroup v-if="fields.length > 0" :header="t('core.characteristics.sheet.extra')" :locked-footer="t('core.characteristics.sheet.locked')">
        <template v-for="field in fields" :key="field.column">
          <SwitchField v-if="field.type === 'yesno'" v-bind="binding(field)" :label="labelOf(field)" :disabled="field.read_only" :data-field-key="`values.${field.column}`" />
          <NumberField v-else-if="field.type === 'number'" v-bind="binding(field)" :label="labelOf(field)" :disabled="field.read_only" :data-field-key="`values.${field.column}`" />
          <SelectField v-else-if="field.type === 'choice'" v-bind="binding(field)" :options="choices(field)" :label="labelOf(field)" :disabled="field.read_only" clearable :data-field-key="`values.${field.column}`" />
          <TextField v-else v-bind="binding(field)" :label="labelOf(field)" :max-length="field.max > 0 ? field.max : undefined" :disabled="field.read_only" :data-field-key="`values.${field.column}`" />
        </template>
      </FormGroup>

      <Banner v-for="field in lockedFields" :key="field.column" tone="info" data-test="characteristic-locked-note">
        {{ t("core.characteristics.sheet.note", { field: labelOf(field), path: where || labelIn(level.label, locale) }) }}
      </Banner>
    </div>

    <template #footer>
      <div class="flex w-full items-center gap-2">
        <Button v-if="props.editable && target?.mode === 'edit'" prominence="plain" tone="critical" icon="deleteBin2Line" data-test="characteristic-delete" @click="target?.mode === 'edit' && emit('remove', target.node)">{{ t("core.characteristics.delete") }}</Button>
        <span class="flex-1"></span>
        <Button prominence="plain" @click="sheet?.dismiss()">{{ props.editable ? t("core.actions.cancel") : t("core.actions.close") }}</Button>
        <Button v-if="props.editable" prominence="primary" icon="save" :processing="form.submitting.value" data-test="characteristic-save" @click="save()">{{ target?.mode === "create" ? t("core.characteristics.sheet.create") : t("core.characteristics.sheet.save") }}</Button>
      </div>
    </template>
  </Sheet>
</template>
