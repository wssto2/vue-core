<script setup lang="ts">
import { CheckboxField, FormGroup, NumberField, SelectField, StepForm, StepProgress, TextField, useForm, useStepForm, type SelectOption } from "@wssto2/vue-core/form";
import { Button } from "@wssto2/vue-core/button";
import { KeyValueList } from "@wssto2/vue-core/content";
import { Modal } from "@wssto2/vue-core/modal";
import { toast } from "@wssto2/vue-core/overlay";
import { useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { createLead, schema, type LeadBody } from "../data";

// A lead in three named steps, in a modal: the bar in the dialog's header, the buttons in its footer and nav bar, the draft kept across a reload.
// Each step names the fields it owns; "taken@example.com" is refused by the server on the last step and takes the user back to the customer.
const { t } = useI18n();
const modal = useTemplateRef<InstanceType<typeof Modal>>("modal");

const makes: readonly SelectOption<string>[] = [
  { value: "skoda", label: "Škoda" },
  { value: "vw", label: "Volkswagen" },
  { value: "seat", label: "SEAT" },
];

const form = useForm({
  defaults: (): LeadBody => ({ name: "", email: "", phone: "", make: null, model: "", budget: null, budgetUnknown: false }),
  validator: schema<LeadBody>((lead) => ({
    name: lead.name.trim() ? undefined : t("workflows.required"),
    email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email) ? undefined : t("workflows.invalidEmail"),
    make: lead.make ? undefined : t("workflows.required"),
    budget: lead.budget !== null || lead.budgetUnknown ? undefined : t("workflows.lead.budgetOrUnknown"),
  })),
});

const flow = useStepForm(form, {
  steps: [
    { name: "customer", label: t("workflows.lead.customer"), fields: ["name", "email", "phone"] },
    { name: "vehicle", label: t("workflows.lead.vehicle"), fields: ["make", "model", "budget", "budgetUnknown"] },
    { name: "review", label: t("workflows.lead.review") },
  ],
  submit: (payload) => createLead(payload),
  onSaved: () => {
    toast.success(t("workflows.lead.created"));
    void modal.value?.dismiss();
  },
  submitLabel: t("workflows.lead.create"),
  draft: { key: "playground:lead:new" },
});

defineExpose({ present: () => modal.value?.present() });
</script>

<template>
  <Modal ref="modal" :title="t('workflows.lead.title')" grouped size="md" v-bind="flow.bindDialog()" @primary="flow.next()" @dismissed="flow.restart()">
    <template #header><StepProgress :flow="flow" /></template>
    <template #timestamp>
      <Button v-if="flow.backLabel.value" prominence="plain" icon="arrowLeftSLine" :disabled="flow.busy.value" @click="flow.back()">{{ flow.backLabel.value }}</Button>
    </template>

    <StepForm :flow="flow" progress="none" navigation="host">
      <template #customer>
        <FormGroup :header="t('workflows.lead.customer')">
          <TextField v-bind="form.bind('name')" :label="t('workflows.lead.name')" required />
          <TextField v-bind="form.bind('email')" type="email" :label="t('workflows.lead.email')" required />
          <TextField v-bind="form.bind('phone')" type="tel" :label="t('workflows.lead.phone')" />
        </FormGroup>
      </template>
      <template #vehicle>
        <FormGroup :header="t('workflows.lead.vehicle')">
          <SelectField v-bind="form.bind('make')" :label="t('workflows.lead.make')" :options="makes" required />
          <TextField v-bind="form.bind('model')" :label="t('workflows.lead.model')" />
          <NumberField v-bind="form.bind('budget')" :label="t('workflows.lead.budget')" suffix="EUR" :disabled="form.values.budgetUnknown" />
          <CheckboxField v-bind="form.bind('budgetUnknown')" :label="t('workflows.lead.budgetUnknown')" />
        </FormGroup>
      </template>
      <template #review>
        <KeyValueList :items="[
          { key: 'name', label: t('workflows.lead.name'), value: form.values.name },
          { key: 'email', label: t('workflows.lead.email'), value: form.values.email },
          { key: 'make', label: t('workflows.lead.make'), value: makes.find((make) => make.value === form.values.make)?.label ?? '' },
          { key: 'budget', label: t('workflows.lead.budget'), value: form.values.budgetUnknown ? t('workflows.lead.budgetUnknown') : String(form.values.budget ?? '') },
        ]" />
      </template>
    </StepForm>
  </Modal>
</template>
