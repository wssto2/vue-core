<script setup lang="ts">
import { AdaptivePageShell } from "@wssto2/vue-core/page";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { ticketRoutes } from "../routes";

const route = useRoute();
const { t } = useI18n();
</script>

<template>
  <!-- a record page: the back leads to the list, on the desktop toolbar and in the phone's top bar -->
  <AdaptivePageShell :title="t('tickets.record', { id: route.params.ticketID })" :back="{ label: t('tickets.title'), to: ticketRoutes.index }" width="content">
    <p class="text-content-muted">{{ t("tickets.back") }}</p>
  </AdaptivePageShell>
</template>
