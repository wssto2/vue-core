<script setup lang="ts">
import { CollectionPage, useCollection, type CollectionColumns } from "@wssto2/vue-core/collection";
import type { PageAction } from "@wssto2/vue-core/page";
import { usePlatform } from "@wssto2/vue-core/platform";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { MODULE_ICON } from "@/features/helpdesk/tickets";
import { ticketsApi, ticketList, type TicketSort } from "../api";
import type { Ticket } from "../types";
import TicketModal from "../components/TicketModal.vue";

const { t } = useI18n();
const { access, http } = usePlatform();

const featureModal = ref<InstanceType<typeof TicketModal> | null>(null);

// One columns array drives the table and the phone row: `mobile` says what a column is on a phone.
const columns = computed(() => [
  { key: "name", label: t("helpdesk.tickets.table_columns.name"), kind: "identity", sort: "name", mobile: "primary", subtitle: (item: Ticket) => `ID: ${item.id}` },
  { key: "created_at", label: t("general.table_columns.created_at"), kind: "timestamp", sort: "created_at", width: 150, align: "center", mobile: "hidden" },
  { key: "updated_at", label: t("general.table_columns.updated_at"), kind: "timestamp", sort: "updated_at", width: 150, align: "center", mobile: "hidden" },
] satisfies CollectionColumns<Ticket, TicketSort>);

const collection = useCollection(ticketList(ticketsApi(http)), { columns, state: { kind: "memory" } });

const actions = computed<PageAction[]>(() => (access.can("helpdesk.tickets:manage") ? [{
  id: "create", label: t("helpdesk.tickets.actions.create"), icon: "addLine", placement: "primary", compact: "icon",
  keyboardShortcut: { key: "N", ctrlKey: true }, onClick: () => featureModal.value?.show(),
}] : []));
</script>

<template>
  <CollectionPage :collection="collection" :title="t('helpdesk.tickets.title')" :description="t('helpdesk.tickets.description')" :icon="MODULE_ICON" :actions="actions">
    <TicketModal ref="featureModal" @changed="collection.refresh()" />
  </CollectionPage>
</template>
