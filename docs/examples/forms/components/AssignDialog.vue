<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { CommandDialog, ComboField, FormGroup, TextareaField, useCommand } from "@wssto2/vue-core/form";
import { useRouteResourceContext } from "@wssto2/vue-core/resource";
import { useI18n } from "vue-i18n";
import { TICKET, useTicketFormsApi } from "../context";

const { t } = useI18n();
const api = useTicketFormsApi();
const ticket = useRouteResourceContext(TICKET);

// A command: one purpose-specific endpoint with its own confirmation. Never a field autosave.
const assign = useCommand({
  defaults: () => ({ assignee: null as number | null, note: "" }),
  validator: {
    safeParse: (input) => {
      const { assignee, note } = input as { assignee: number | null; note: string };
      return assignee === null ? { success: false, error: { issues: [{ path: ["assignee"], message: "Choose who takes it." }] } } : { success: true, data: { assignee, note } };
    },
  },
  run: (input, { idempotencyKey }) => api.assign(ticket.id.value ?? 0, { assignee_id: input.assignee, note: input.note }, idempotencyKey),
  done: (saved) => ticket.update(saved),
});
</script>

<template>
  <Button @click="assign.present()">{{ t("forms.assign") }}</Button>
  <CommandDialog :command="assign" :title="t('forms.assign')" :confirm-label="t('forms.assign')">
    <FormGroup>
      <ComboField v-bind="assign.form.bind('assignee')" :label="t('forms.assignee')" :search="(query, { signal }) => api.users(query, signal)" />
      <TextareaField v-bind="assign.form.bind('note')" :label="t('forms.note')" stacked />
    </FormGroup>
  </CommandDialog>
</template>
