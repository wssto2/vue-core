<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { ticketRoutes } from "../routes";

const route = useRoute();
const { t } = useI18n();
</script>

<template>
  <h1 class="text-large-title font-semibold text-content-strong">{{ t("tickets.record", { id: route.params.ticketID }) }}</h1>
  <RouterLink :to="ticketRoutes.index" class="text-content-link">{{ t("tickets.back") }}</RouterLink>
</template>
