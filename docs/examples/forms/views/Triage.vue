<script setup lang="ts">
import { NumberField, StepForm, TextField, useForm, useStepForm } from "@wssto2/vue-core/form";
import { AdaptivePageShell } from "@wssto2/vue-core/page";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

const { t } = useI18n();
const router = useRouter();

const form = useForm({ defaults: () => ({ subject: "", urgent: null as number | null, reason: "" }) });
const asksReason = computed(() => (form.values.urgent ?? 0) > 2);

// The steps depend on an answer: a high urgency adds a question. The user stays on their step by name, and the
// dots count what is asked now (a bar of names could not say in advance).
const flow = useStepForm(form, {
  steps: () => [
    { name: "subject" as const, label: t("forms.subject"), fields: ["subject" as const] },
    { name: "urgent" as const, label: t("forms.priority"), fields: ["urgent" as const] },
    ...(asksReason.value ? [{ name: "reason" as const, label: t("forms.reason"), fields: ["reason" as const] }] : []),
    { name: "review" as const, label: t("forms.review") },
  ],
  submit: async () => undefined,
  onSaved: () => void router.push("/"),
});
</script>

<template>
  <!-- On a page the flow draws its own Back, Cancel and Next under the step. -->
  <AdaptivePageShell :title="t('forms.triage')" :description="flow.subtitle.value" width="content">
    <StepForm :flow="flow" progress="dots" @cancel="router.push('/')">
      <template #subject><h3 class="text-center text-title font-bold">{{ t("forms.subjectQuestion") }}</h3><TextField v-bind="form.bind('subject')" :label="t('forms.subject')" /></template>
      <template #urgent><h3 class="text-center text-title font-bold">{{ t("forms.priorityQuestion") }}</h3><NumberField v-bind="form.bind('urgent')" :label="t('forms.priority')" /></template>
      <template #reason><h3 class="text-center text-title font-bold">{{ t("forms.reasonQuestion") }}</h3><TextField v-bind="form.bind('reason')" :label="t('forms.reason')" /></template>
      <template #review><p class="text-center">{{ form.values.subject }}</p></template>
    </StepForm>
  </AdaptivePageShell>
</template>
