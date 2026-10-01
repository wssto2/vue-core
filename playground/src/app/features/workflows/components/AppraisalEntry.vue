<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { NumberField, OptionList, StepForm, TextField, useForm, useStepForm } from "@wssto2/vue-core/form";
import { Modal } from "@wssto2/vue-core/modal";
import { toast } from "@wssto2/vue-core/overlay";
import { computed, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { findVersions, schema, sleep } from "../data";

// A new appraisal in steps that depend on answers: one question per screen with dots, since the number of steps is only known after the VIN
// lookup (a VIN ending in an odd digit finds three versions and asks which one; any other finds one and skips that question).
const { t } = useI18n();
const modal = useTemplateRef<InstanceType<typeof Modal>>("modal");

interface Entry {
  vin: string;
  versionId: string | null;
  mileage: number | null;
}
const candidates = ref<readonly { id: string; label: string }[]>([]);
const asksVersion = computed(() => candidates.value.length > 1);

const form = useForm({
  defaults: (): Entry => ({ vin: "", versionId: null, mileage: null }),
  validator: schema<Entry>((entry) => ({
    vin: /^[A-HJ-NPR-Z0-9]{17}$/i.test(entry.vin) ? undefined : t("workflows.appraisal.vinInvalid"),
    versionId: asksVersion.value && !entry.versionId ? t("workflows.required") : undefined,
    mileage: entry.mileage === null ? t("workflows.required") : undefined,
  })),
});

const flow = useStepForm(form, {
  steps: () => [
    {
      name: "vin" as const,
      label: t("workflows.appraisal.vin"),
      fields: ["vin" as const],
      // The lookup is the step's work: the button waits, the dots then count what is really asked.
      beforeNext: async () => {
        candidates.value = await findVersions(form.values.vin);
        form.values.versionId = candidates.value.length === 1 ? candidates.value[0]!.id : null;
        return true;
      },
    },
    ...(asksVersion.value ? [{ name: "version" as const, label: t("workflows.appraisal.version"), fields: ["versionId" as const] }] : []),
    { name: "mileage" as const, label: t("workflows.appraisal.mileage"), fields: ["mileage" as const] },
    { name: "review" as const, label: t("workflows.appraisal.reviewStep") },
  ],
  submit: async () => {
    await sleep(600);
    return 1;
  },
  submitLabel: t("workflows.appraisal.create"),
  onSaved: () => {
    toast.success(t("workflows.appraisal.created"));
    void modal.value?.dismiss();
  },
});

function reset() {
  candidates.value = [];
  flow.restart();
}
defineExpose({ present: () => modal.value?.present() });
</script>

<template>
  <Modal ref="modal" :title="t('workflows.appraisal.newTitle')" grouped size="md" v-bind="flow.bindDialog()" :processing-label="t('workflows.appraisal.searching')" @primary="flow.next()" @dismissed="reset">
    <template #timestamp>
      <Button v-if="flow.backLabel.value" prominence="plain" icon="arrowLeftSLine" :disabled="flow.busy.value" @click="flow.back()">{{ flow.backLabel.value }}</Button>
    </template>

    <StepForm :flow="flow" progress="dots" navigation="host">
      <template #vin>
        <h3 class="text-center text-title font-bold">{{ t("workflows.appraisal.vinQuestion") }}</h3>
        <TextField v-bind="form.bind('vin')" :label="t('workflows.appraisal.vin')" mono :max-length="17" placeholder="WVWZZZAUZLP000001" />
      </template>
      <template #version>
        <h3 class="text-center text-title font-bold">{{ t("workflows.appraisal.versionQuestion") }}</h3>
        <p class="-mt-2 text-center text-footnote text-content-muted">{{ t("workflows.appraisal.versionHint", { count: candidates.length }) }}</p>
        <OptionList :options="candidates.map((candidate) => ({ value: candidate.id, label: candidate.label }))" :model-value="form.values.versionId" @select="form.bind('versionId')['onUpdate:modelValue']($event)" />
        <p v-if="form.errors.first('versionId')" class="text-center text-footnote text-status-danger-content">{{ form.errors.first("versionId") }}</p>
      </template>
      <template #mileage>
        <h3 class="text-center text-title font-bold">{{ t("workflows.appraisal.mileageQuestion") }}</h3>
        <NumberField v-bind="form.bind('mileage')" :label="t('workflows.appraisal.mileage')" suffix="km" />
      </template>
      <template #review>
        <h3 class="text-center text-title font-bold">{{ t("workflows.appraisal.reviewQuestion") }}</h3>
        <p class="text-center text-subheadline">{{ candidates.find((candidate) => candidate.id === form.values.versionId)?.label }} · {{ form.values.mileage }} km</p>
      </template>
    </StepForm>
  </Modal>
</template>
