<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { CommandDialog, DateField, FormGroup, StepForm, TextField, useCommand, useForm, useStepForm } from "@wssto2/vue-core/form";
import { Sheet } from "@wssto2/vue-core/modal";
import { AdaptivePageShell } from "@wssto2/vue-core/page";
import { ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";

// A long step in a phone sheet (it opens at its top, the progress in view) and a command that asks before it runs.
const { t } = useI18n();
const sheet = useTemplateRef<InstanceType<typeof Sheet>>("sheet");
const form = useForm({ defaults: () => ({ name: "", notes: Array.from({ length: 24 }, () => "") as string[], extra: "" }) });
const flow = useStepForm(form, {
  steps: [
    { name: "first", label: t("forms.steps.first") },
    { name: "long", label: t("forms.steps.long") },
    { name: "last", label: t("forms.steps.last") },
  ],
  submit: async () => ({}),
  submitLabel: t("forms.steps.finish"),
  onSaved: () => void sheet.value?.dismiss(),
});

const sent = ref(0);
const deliver = useCommand({
  defaults: () => ({ deliveredOn: null as string | null }),
  // A day is required: pressing the primary with none shows the banner; fixing it and pressing again puts the question, and the banner is gone.
  validator: { safeParse: (input) => ((input as { deliveredOn: string | null }).deliveredOn === null ? { success: false, error: { issues: [{ path: ["deliveredOn"], message: t("forms.required") }] } } : { success: true, data: input as { deliveredOn: string } }) },
  run: async () => { sent.value += 1; return {}; },
  ask: (input) => ({ title: t("forms.steps.askTitle"), message: t("forms.steps.askBody", { date: input.deliveredOn }), confirmLabel: t("forms.steps.askConfirm"), icon: "box2Line", tone: "warning" }),
});
</script>

<template>
  <AdaptivePageShell :title="t('forms.steps.title')" :description="t('forms.steps.intro')" width="content">
    <div class="flex gap-2">
      <Button @click="sheet?.present()">{{ t("forms.steps.open") }}</Button>
      <Button prominence="secondary" @click="deliver.present()">{{ t("forms.steps.deliver") }}</Button>
    </div>
    <p id="ask-status" class="mt-group-gap text-footnote text-content-muted">{{ t("forms.steps.sent", { count: sent }) }}</p>

    <Sheet ref="sheet" :title="t('forms.steps.sheet')" grouped>
      <StepForm :flow="flow" progress="dots" @cancel="sheet?.dismiss()">
        <template #first><FormGroup><TextField v-model="form.values.name" :label="t('forms.steps.name')" /></FormGroup></template>
        <template #long>
          <FormGroup :header="t('forms.steps.longHeader')">
            <TextField v-for="(_, index) in form.values.notes" :key="index" v-model="form.values.notes[index]" :label="t('forms.steps.note', { n: index + 1 })" />
          </FormGroup>
        </template>
        <template #last>
          <FormGroup :header="t('forms.steps.lastHeader')">
            <TextField v-model="form.values.extra" :label="t('forms.steps.extra')" />
            <TextField v-for="(_, index) in form.values.notes" :key="index" v-model="form.values.notes[index]" :label="t('forms.steps.note', { n: index + 1 })" />
          </FormGroup>
        </template>
      </StepForm>
    </Sheet>

    <CommandDialog :command="deliver" :title="t('forms.steps.deliver')" :confirm-label="t('forms.steps.deliver')">
      <FormGroup><DateField v-bind="deliver.form.bind('deliveredOn')" :label="t('forms.steps.date')" /></FormGroup>
    </CommandDialog>
  </AdaptivePageShell>
</template>
