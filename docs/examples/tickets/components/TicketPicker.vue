<script setup lang="ts">
import { CollectionTable, useCollection, type CollectionColumns } from "@wssto2/vue-core/collection";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { Ticket } from "../api";
import { useTickets } from "../context";

// The list inside a dialog that chooses a ticket (to link, to merge into): it emits the choice, the
// dialog closes itself. Mount it when the dialog opens, so it starts clean.
const emit = defineEmits<{ select: [ticket: Ticket] }>();

const { t } = useI18n();
const { list } = useTickets();

const columns = computed(() => [
  { key: "subject", label: t("tickets.subject"), kind: "identity", mobile: "primary" },
  { key: "status", label: t("tickets.status"), kind: "badge", tone: (ticket: Ticket) => (ticket.status === "open" ? "warning" : "positive"), text: (ticket: Ticket) => t(`tickets.${ticket.status}`), mobile: "accessory" },
] satisfies CollectionColumns<Ticket>);

// Memory state: a picker in a dialog keeps its search out of the URL, and has no record to open.
const tickets = useCollection(list, { columns, state: { kind: "memory" } });
</script>

<template>
  <!-- `pick` instead of `recordRoute`: a row is a choice, not a link. Click or tap a row, arrow to it and press Enter, or search down to one and press Enter. -->
  <CollectionTable :collection="tickets" :pick="(ticket) => emit('select', ticket)" :pick-label="t('tickets.pick')" />
</template>
