<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>

<template>
  <h1 class="text-large-title font-semibold text-content-strong">{{ t("reports.title") }}</h1>
</template>
