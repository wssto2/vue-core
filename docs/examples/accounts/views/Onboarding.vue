<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { SectionNavigator, type SectionStep } from "@wssto2/vue-core/page";
import { AppRouterView } from "@wssto2/vue-core/router";

const { t } = useI18n();
const props = defineProps<{ profileDone: boolean; documents: number; missing: readonly string[] }>();

// A record that is worked on over days, by several people, in any order: each section is a step with one line saying where it
// stands. The keys are the sections' route names; a section without an entry is simply not done and has no line.
const steps = computed<Record<string, SectionStep>>(() => ({
  "accounts.onboarding.profile": props.profileDone ? { done: true, sub: t("accounts.onboarding.complete") } : { done: false, sub: t("accounts.onboarding.profileOpen") },
  "accounts.onboarding.documents": props.missing.length > 0
    ? { done: false, sub: t("accounts.onboarding.missing", { what: props.missing.join(", ") }), shortSub: t("accounts.onboarding.missingShort"), tone: "warning" }
    : { done: true, sub: t("accounts.onboarding.documentsCount", { count: props.documents }) },
}));
</script>

<template>
  <SectionNavigator :label="t('accounts.onboarding.label')" :steps="steps">
    <AppRouterView />
  </SectionNavigator>
</template>
