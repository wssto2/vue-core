<script setup lang="ts">
import { CollectionPage, useCollection, type CollectionColumns } from "@wssto2/vue-core/collection";
import { toast } from "@wssto2/vue-core/overlay";
import type { PageAction } from "@wssto2/vue-core/page";
import { usePlatform } from "@wssto2/vue-core/platform";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { Ticket } from "../api";
import { useTickets } from "../context";
import { ticketRoutes } from "../routes";

const { t } = useI18n();
const { access } = usePlatform();
const { list } = useTickets();

// One columns array drives the table and the phone row: `mobile` says what a column is on a phone.
const columns = computed(() => [
  { key: "subject", label: t("tickets.subject"), kind: "identity", sort: "subject", mobile: "primary" },
  { key: "status", label: t("tickets.status"), kind: "badge", tone: (ticket: Ticket) => (ticket.status === "open" ? "warning" : "positive"), text: (ticket: Ticket) => t(`tickets.${ticket.status}`), mobile: "accessory" },
  { key: "assignee", label: t("tickets.assignee"), hideBelow: "md", mobile: "meta" },
  { key: "created_at", label: t("tickets.created"), kind: "timestamp", sort: "created_at", width: 160, mobile: "meta" },
] satisfies CollectionColumns<Ticket>);

const filters = computed(() => [
  { key: "status" as const, label: t("tickets.status"), type: "select" as const, options: [{ value: "open", label: t("tickets.open") }, { value: "closed", label: t("tickets.closed") }] },
]);

// State (page, sort, search, filters) lives in the URL under `query`; a row links to its record, carrying it.
const tickets = useCollection(list, {
  columns,
  filters,
  state: { kind: "url", key: "query" },
  recordRoute: (ticket) => ticketRoutes.record({ ticketID: ticket.id }),
});

// Only actions the user may use; the page decides where they render.
const actions = computed<PageAction[]>(() =>
  access.can("tickets:update")
    ? [{ id: "create", label: t("tickets.create"), placement: "primary", keyboardShortcut: { key: "N", ctrlKey: true }, onClick: () => toast.info(t("tickets.create")) }]
    : [],
);
</script>

<template>
  <CollectionPage :collection="tickets" :title="t('tickets.title')" :description="t('tickets.description')" :actions="actions" />
</template>
