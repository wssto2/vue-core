<script setup lang="ts">
import { RecordHeader, SectionNavigator, AdaptivePageShell, type SectionStep } from "@wssto2/vue-core/page";
import { useFormat } from "@wssto2/vue-core/format";
import { AppRouterView } from "@wssto2/vue-core/router";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { appraisal } from "../data";
import { workflowRoutes } from "../routes";

// An appraisal as a workflow: the sections are steps, each with one line saying where it stands. They are links in any order, not a wizard;
// change something inside a step and its tile follows.
const { t } = useI18n();
const format = useFormat();

const steps = computed<Record<string, SectionStep>>(() => ({
  "workflows.appraisal.valuation": appraisal.valuation === null
    ? { done: false, sub: t("workflows.appraisal.noValuation"), tone: "warning" }
    : { done: true, sub: format.money(appraisal.valuation, "EUR") },
  "workflows.appraisal.report": appraisal.marketComparison
    ? { done: true, sub: t("workflows.appraisal.reportDone", { n: appraisal.photos }), shortSub: t("workflows.appraisal.reportDoneShort") }
    : { done: false, sub: t("workflows.appraisal.reportMissing"), shortSub: t("workflows.appraisal.reportMissingShort"), tone: "warning" },
  "workflows.appraisal.offer": appraisal.offer === null ? { done: false, sub: t("workflows.appraisal.noOffer") } : { done: true, sub: format.money(appraisal.offer, "EUR"), tone: "positive" },
}));
</script>

<template>
  <AdaptivePageShell :title="t('workflows.appraisal.title')" :back="{ label: t('workflows.title'), to: workflowRoutes.index }">
    <template #header><RecordHeader title="VW Golf 8 1.5 TSI" subtitle="WVWZZZAUZLP000001" /></template>
    <SectionNavigator :label="t('workflows.appraisal.steps')" :steps="steps">
      <AppRouterView />
    </SectionNavigator>
  </AdaptivePageShell>
</template>
