<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Panel } from "@wssto2/vue-core/content";

const { t } = useI18n();
</script>

<template><Panel :title="t('records.sections.audit')" /></template>
