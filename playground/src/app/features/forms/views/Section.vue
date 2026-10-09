<script setup lang="ts">
import { AdaptivePageShell } from "@wssto2/vue-core/page";
import { useI18n } from "vue-i18n";
import SectionForm from "../components/SectionForm.vue";

const { t } = useI18n();
</script>

<template>
  <AdaptivePageShell :title="t('forms.section.title')" :description="t('forms.section.intro')" width="content">
    <SectionForm />
  </AdaptivePageShell>
</template>
