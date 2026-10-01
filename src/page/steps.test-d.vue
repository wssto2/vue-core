<script setup lang="ts">
// Type fixture (checked by `npm run typecheck`, never built): the state of a workflow step is typed.
import SectionNavigator from "./SectionNavigator.vue";
import type { SectionStep } from "./types";

const good: Record<string, SectionStep> = { "appraisal.valuation": { done: true, sub: "12 400 €" }, "appraisal.report": { done: false, sub: "Missing", shortSub: "Missing", tone: "warning" } };
</script>

<template>
  <SectionNavigator label="Steps" :steps="good" />
  <!-- @vue-expect-error a tone the library does not have -->
  <SectionNavigator label="Steps" :steps="{ a: { done: false, tone: 'urgent' } }" />
  <!-- @vue-expect-error a step says whether it is done -->
  <SectionNavigator label="Steps" :steps="{ a: { sub: 'x' } }" />
</template>
