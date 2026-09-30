<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { customerIds, dealerIds, leadIds } from "../api";
import { recordRoutes } from "../routes";

const { t } = useI18n();
const link = "text-content-link hover:underline";
</script>

<template>
  <div class="flex max-w-readable flex-col gap-4">
    <h1 class="text-large-title font-semibold text-content-strong">{{ t("records.title") }}</h1>
    <p class="text-content-muted">{{ t("records.index.intro") }}</p>
    <section>
      <h2 class="font-semibold">{{ t("records.dealers") }}</h2>
      <ul class="flex gap-3">
        <li v-for="id in dealerIds" :key="id"><RouterLink :to="recordRoutes.dealer({ dealerID: id })" :class="link">{{ t("records.dealer") }} {{ id }}</RouterLink></li>
      </ul>
    </section>
    <section>
      <h2 class="font-semibold">{{ t("records.customers") }}</h2>
      <ul class="flex gap-3">
        <li v-for="id in customerIds" :key="id"><RouterLink :to="recordRoutes.customer({ customerID: id })" :class="link">{{ t("records.customer") }} {{ id }}</RouterLink></li>
      </ul>
    </section>
    <section>
      <h2 class="font-semibold">{{ t("records.leads") }}</h2>
      <ul class="flex gap-3">
        <li v-for="id in leadIds" :key="id"><RouterLink :to="recordRoutes.lead({ leadID: id })" :class="link">{{ t("records.lead") }} {{ id }}</RouterLink></li>
        <li><RouterLink :to="recordRoutes.lead({ leadID: 999 })" :class="link">{{ t("records.index.missing") }}</RouterLink></li>
      </ul>
    </section>
  </div>
</template>
