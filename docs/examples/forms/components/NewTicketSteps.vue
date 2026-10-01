<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { FormGroup, NumberField, StepForm, StepProgress, TextField, useForm, useStepForm } from "@wssto2/vue-core/form";
import { Modal } from "@wssto2/vue-core/modal";
import { useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { useTicketFormsApi } from "../context";

const { t } = useI18n();
const api = useTicketFormsApi();
const modal = useTemplateRef<InstanceType<typeof Modal>>("modal");

const form = useForm({
  defaults: () => ({ subject: "", priority: null as number | null, email: "", phone: "" }),
  validator: {
    safeParse: (input) => {
      const draft = input as { subject: string; priority: number | null; email: string; phone: string };
      const issues = draft.subject.trim() === "" ? [{ path: ["subject"], message: t("forms.subjectRequired") }] : [];
      return issues.length > 0 ? { success: false, error: { issues } } : { success: true, data: draft };
    },
  },
});

// Each step names the fields it owns: Next checks those and nothing else, the step counts their errors, and an error
// the server sends for one of them takes the user back to the step.
const flow = useStepForm(form, {
  steps: [
    { name: "details", label: t("forms.details"), fields: ["subject", "priority"] },
    { name: "contact", label: t("forms.contact"), fields: ["email", "phone"] },
    { name: "review", label: t("forms.review") },
  ],
  submit: (payload, { idempotencyKey }) => api.create({ subject: payload.subject, priority: payload.priority, due_on: null, email: payload.email, phone: payload.phone }, idempotencyKey),
  submitLabel: t("forms.create"),
  onSaved: () => void modal.value?.dismiss(),
  draft: { key: "tickets:new" }, // survives a reload; removed on submit and on discard
});

defineExpose({ present: () => modal.value?.present() });
</script>

<template>
  <!-- The dialog takes its subtitle ("Step 2 of 3 · Contact"), its primary button ("Next: Review"), the wait and the
       "Discard changes?" question from the flow; the bar goes in its header and Back, named after its target, in its footer. -->
  <Modal ref="modal" :title="t('forms.newTicket')" grouped size="md" v-bind="flow.bindDialog()" @primary="flow.next()" @dismissed="flow.restart()">
    <template #header><StepProgress :flow="flow" /></template>
    <template #timestamp><Button v-if="flow.backLabel.value" prominence="plain" icon="arrowLeftSLine" @click="flow.back()">{{ flow.backLabel.value }}</Button></template>

    <StepForm :flow="flow" progress="none" navigation="host">
      <template #details>
        <FormGroup>
          <TextField v-bind="form.bind('subject')" :label="t('forms.subject')" required />
          <NumberField v-bind="form.bind('priority')" :label="t('forms.priority')" />
        </FormGroup>
      </template>
      <template #contact>
        <FormGroup>
          <TextField v-bind="form.bind('email')" type="email" :label="t('forms.email')" />
          <TextField v-bind="form.bind('phone')" type="tel" :label="t('forms.phone')" />
        </FormGroup>
      </template>
      <template #review><p>{{ form.values.subject }}</p></template>
    </StepForm>
  </Modal>
</template>
