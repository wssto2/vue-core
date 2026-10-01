<script setup lang="ts">
import { DataTable, RowActions, type RowAction, type TableColumns } from "@wssto2/vue-core/collection";
import { Panel } from "@wssto2/vue-core/content";
import { toast } from "@wssto2/vue-core/overlay";
import { usePlatform } from "@wssto2/vue-core/platform";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

interface TicketEvent {
  readonly id: number;
  readonly at: string;
  readonly kind: "comment" | "change";
  readonly author: string;
  readonly note: string;
}

// The array is already on the page (the record carries it): no loader, no paging, no URL state.
defineProps<{ events: readonly TicketEvent[] }>();

const { t } = useI18n();
const { access } = usePlatform();

// The collection's columns, without sorting: the table keeps the order it was given.
const columns = computed(() => [
  { key: "at", label: t("tickets.when"), kind: "timestamp", width: 170, mobile: "meta" },
  { key: "kind", label: t("tickets.kind"), kind: "badge", tone: (event: TicketEvent) => (event.kind === "change" ? "info" : "neutral"), text: (event: TicketEvent) => t(`tickets.${event.kind}`), mobile: "accessory" },
  { key: "author", label: t("tickets.author"), hideBelow: "md", mobile: "meta" },
  { key: "note", label: t("tickets.note"), mobile: "primary" },
] satisfies TableColumns<TicketEvent>);

// Only what the user may do; the same array feeds the buttons, the phone row's swipe and the context menu.
const actionsOf = (event: TicketEvent): RowAction[] =>
  access.can("tickets:update") ? [{ key: "remove", label: t("tickets.remove"), icon: "deleteBin2Line", tone: "critical", onSelect: () => toast.info(`${t("tickets.remove")} #${event.id}`) }] : [];
</script>

<template>
  <Panel :title="t('tickets.history')" flush>
    <DataTable :rows="events" :columns="columns" :row-key="(event) => event.id" density="condensed" :row-actions="actionsOf" :row-label="(event) => event.note">
      <!-- A cell slot replaces a column's rendering; `item` is a TicketEvent, `compact` is true in the phone row. -->
      <template #cell-note="{ item, compact }"><span :class="compact ? 'text-row-title' : ''">{{ item.note }}</span></template>
      <template #actions="{ item }"><RowActions :actions="actionsOf(item)" /></template>
      <template #empty>{{ t("tickets.history_empty") }}</template>
    </DataTable>
  </Panel>
</template>
