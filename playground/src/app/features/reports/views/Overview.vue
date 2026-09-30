<script setup lang="ts">
import { AdaptivePageShell } from "@wssto2/vue-core/page";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>

<template>
  <AdaptivePageShell :title="t('reports.title')" />
</template>
