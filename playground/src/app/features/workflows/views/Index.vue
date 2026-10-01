<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { FormGroup, FormRow } from "@wssto2/vue-core/form";
import { AdaptivePageShell } from "@wssto2/vue-core/page";
import { useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import AppraisalEntry from "../components/AppraisalEntry.vue";
import LeadWizard from "../components/LeadWizard.vue";
import { workflowRoutes } from "../routes";

const { t } = useI18n();
const lead = useTemplateRef<InstanceType<typeof LeadWizard>>("lead");
const entry = useTemplateRef<InstanceType<typeof AppraisalEntry>>("entry");
</script>

<template>
  <AdaptivePageShell :title="t('workflows.title')" :description="t('workflows.intro')" width="content">
    <FormGroup :header="t('workflows.stepForms')" :footer="t('workflows.stepFormsHint')">
      <FormRow :label="t('workflows.lead.title')" :sub="t('workflows.leadSub')" layout="setting">
        <Button prominence="primary" @click="lead?.present()">{{ t("workflows.open") }}</Button>
      </FormRow>
      <FormRow :label="t('workflows.appraisal.newTitle')" :sub="t('workflows.entrySub')" layout="setting">
        <Button prominence="primary" @click="entry?.present()">{{ t("workflows.open") }}</Button>
      </FormRow>
    </FormGroup>

    <FormGroup :header="t('workflows.records')">
      <FormRow :label="t('workflows.appraisal.title')" :sub="t('workflows.appraisalSub')" :to="workflowRoutes.appraisal({ appraisalID: 1 })" layout="setting" />
      <FormRow :label="t('workflows.photos.title')" :sub="t('workflows.photosSub')" :to="workflowRoutes.photos" layout="setting" />
    </FormGroup>

    <LeadWizard ref="lead" />
    <AppraisalEntry ref="entry" />
  </AdaptivePageShell>
</template>
