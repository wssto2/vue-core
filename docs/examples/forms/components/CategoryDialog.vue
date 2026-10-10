<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { CommandDialog, FormGroup, SwitchField, TextField, useRecordDialog } from "@wssto2/vue-core/form";
import { toast } from "@wssto2/vue-core/overlay";
import { useI18n } from "vue-i18n";
import type { Category } from "../api";
import { useTicketFormsApi } from "../context";

const emit = defineEmits<{ saved: [] }>();
const { t } = useI18n();
const api = useTicketFormsApi();

// One dialog for both: `create` for a new category, `update` for an edited one. The dialog brings the discard guard, the "saved" beat, the field errors and the focus.
const category = useRecordDialog({
  defaults: () => ({ name: "", active: true }),
  validator: { safeParse: (input) => ((input as { name: string }).name.trim() === "" ? { success: false, error: { issues: [{ path: ["name"], message: "Enter a name." }] } } : { success: true, data: input as { name: string; active: boolean } }) },
  toValues: (row: Category) => ({ name: row.name, active: row.active }),
  create: (input, { idempotencyKey }) => api.createCategory(input, idempotencyKey),
  update: (row, input, { idempotencyKey }) => api.updateCategory(row.id, input, idempotencyKey),
  done: () => {
    toast.success(t("forms.categorySaved"));
    emit("saved");
  },
});

defineExpose({ create: category.create, edit: category.edit });
</script>

<template>
  <CommandDialog :command="category.command" :title="category.editing.value ? t('forms.editCategory') : t('forms.newCategory')" :confirm-label="t('forms.save')">
    <FormGroup>
      <TextField v-bind="category.form.bind('name')" :label="t('forms.name')" required />
      <SwitchField v-bind="category.form.bind('active')" :label="t('forms.active')" />
    </FormGroup>
    <template v-if="!category.editing.value" #actions="{ run, busy }">
      <Button :disabled="busy" @click="run({ addAnother: true })">{{ t("forms.saveAndAddAnother") }}</Button>
    </template>
  </CommandDialog>
</template>
