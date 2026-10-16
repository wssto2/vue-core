<script setup lang="ts">
import { PickerModal } from "@wssto2/vue-core/collection";
import { useI18n } from "vue-i18n";
import { ticketPicker } from "../picker";
import TicketPicker from "./TicketPicker.vue";

// Mounted once where the application keeps its dialogs (a `host` contribution). The list inside is mounted each time the dialog opens.
const { t } = useI18n();
</script>

<template>
  <PickerModal :picker="ticketPicker" :title="t('tickets.pick')" v-slot="{ select }">
    <TicketPicker @select="select" />
  </PickerModal>
</template>
