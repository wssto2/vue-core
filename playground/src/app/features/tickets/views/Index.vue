<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { ticketRoutes } from "../routes";
import { useTickets } from "../context";

const { list } = useTickets();
const { t } = useI18n();
</script>

<template>
  <h1 class="text-large-title font-semibold text-content-strong">{{ t("tickets.title") }}</h1>
  <ul class="mt-3 flex flex-col gap-1">
    <li v-for="ticket in list()" :key="ticket.id">
      <!-- a typed target: a wrong or missing parameter does not compile -->
      <RouterLink :to="ticketRoutes.record({ ticketID: ticket.id })" class="text-content-link">{{ ticket.subject }}</RouterLink>
    </li>
  </ul>
</template>
