<script setup lang="ts">
import { NextStepPanel, PhaseTiles, PhaseTrack, RequirementList, TodoRow, type PhaseStep, type PhaseTile, type RequirementItem } from "@wssto2/vue-core/state";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const steps: PhaseStep[] = [{ label: "Takeover" }, { label: "Preparation", subtitle: "3 days" }, { label: "Sale" }, { label: "Archive", dashed: true }];
const phases: PhaseTile[] = [
  { key: "takeover", label: "Takeover", state: "done", sub: "12 Sep" },
  { key: "preparation", label: "Preparation", state: "current", sub: "2 items missing", tone: "warning" },
  { key: "sale", label: "Sale", state: "later" },
];
const requirements: RequirementItem[] = [
  { key: "vin", label: "VIN present", met: true },
  { key: "price", label: "List price set", met: false, hint: "Enter a price", fix: { label: "Fill in", to: { name: "tickets.index" } } },
];
</script>

<template>
  <!-- track -->
  <PhaseTrack :steps="steps" :current-step="1" :title="t('tickets.phase')" compact-on-mobile />
  <!-- tiles -->
  <PhaseTiles :label="t('tickets.phase')" :phases="phases" />
  <!-- todo -->
  <TodoRow state="missing" label="Required data" sub="Missing: colour" :to="{ name: 'tickets.index' }" />
  <TodoRow state="missing" label="Checklist" :action="{ label: 'Fill in', onClick: () => undefined }" />
  <!-- next -->
  <NextStepPanel body="The vehicle moves to Sale." :action="{ label: 'Move to sale…', disabled: true }" reason="Enter the colour first." :note="t('core.next_step.menu_hint', { action: 'Back to appraisal' })" />
  <!-- requirements -->
  <RequirementList :items="requirements" :title="t('tickets.missing')" summary-when-met="Ready to activate" />
</template>
