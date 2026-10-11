<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { CommandDialog, DateField, FormGroup, useCommand } from "@wssto2/vue-core/form";
import { useRouteResourceContext } from "@wssto2/vue-core/resource";
import { useI18n } from "vue-i18n";
import { TICKET, useTicketFormsApi } from "../context";

const { t } = useI18n();
const api = useTicketFormsApi();
const ticket = useRouteResourceContext(TICKET);

// A command that asks first: the inputs are checked, then the question is put, and only Yes calls. Cancel returns to the filled form.
const close = useCommand({
  defaults: () => ({ closedOn: null as string | null }),
  run: (input, { idempotencyKey }) => api.assign(ticket.id.value ?? 0, { assignee_id: 0, note: input.closedOn ?? "" }, idempotencyKey),
  done: (saved) => ticket.update(saved),
  ask: (input) => (input.closedOn === null ? null : { title: t("forms.closeTitle"), message: t("forms.closeBody", { date: input.closedOn }), confirmLabel: t("forms.close"), icon: "box2Line", tone: "warning" }),
});
</script>

<template>
  <Button @click="close.present()">{{ t("forms.close") }}</Button>
  <CommandDialog :command="close" :title="t('forms.close')" :confirm-label="t('forms.close')">
    <FormGroup><DateField v-bind="close.form.bind('closedOn')" :label="t('forms.closedOn')" /></FormGroup>
  </CommandDialog>
</template>
