<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { CommandDialog, FormGroup, SwitchField, TextField, useCommand } from "@wssto2/vue-core/form";
import { toast } from "@wssto2/vue-core/overlay";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import type { Category } from "../api";
import { useTicketFormsApi } from "../context";

const emit = defineEmits<{ saved: [] }>();
const { t } = useI18n();
const api = useTicketFormsApi();
const editing = ref<Category | null>(null); // null: a new one

// One command for both: create or edit. The dialog brings the discard guard, the "saved" beat, the field errors and the focus.
const save = useCommand({
  defaults: () => ({ name: "", active: true }),
  validator: { safeParse: (input) => ((input as { name: string }).name.trim() === "" ? { success: false, error: { issues: [{ path: ["name"], message: "Enter a name." }] } } : { success: true, data: input as { name: string; active: boolean } }) },
  run: (input, { idempotencyKey }) => (editing.value ? api.updateCategory(editing.value.id, input, idempotencyKey) : api.createCategory(input, idempotencyKey)),
  done: () => {
    toast.success(t("forms.categorySaved"));
    emit("saved");
  },
});

defineExpose({
  create: () => ((editing.value = null), save.present()),
  edit: (category: Category) => ((editing.value = category), save.present({ name: category.name, active: category.active })),
});
</script>

<template>
  <CommandDialog :command="save" :title="editing ? t('forms.editCategory') : t('forms.newCategory')" :confirm-label="t('forms.save')">
    <FormGroup>
      <TextField v-bind="save.form.bind('name')" :label="t('forms.name')" required />
      <SwitchField v-bind="save.form.bind('active')" :label="t('forms.active')" />
    </FormGroup>
    <template v-if="!editing" #actions="{ run, busy }">
      <Button :disabled="busy" @click="run({ addAnother: true })">{{ t("forms.saveAndAddAnother") }}</Button>
    </template>
  </CommandDialog>
</template>
