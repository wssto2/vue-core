<script setup lang="ts">
import { DataTable, RowActions, type RowAction, type TableColumns } from "@wssto2/vue-core/collection";
import { Panel } from "@wssto2/vue-core/content";
import { toast } from "@wssto2/vue-core/overlay";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

interface Activity {
  readonly id: number;
  readonly at: string;
  readonly kind: "call" | "visit" | "offer";
  readonly by: string;
  readonly note: string;
  readonly amount: number | null;
}

// A plain array on a record page: no loader, no paging, no URL state.
const props = defineProps<{ customerId: number }>();

const { t } = useI18n();

const all = computed<Activity[]>(() => [
  { id: 1, at: "2026-09-28T09:15:00Z", kind: "call", by: "Ana Horvat", note: `#${props.customerId} asked about a test drive`, amount: null },
  { id: 2, at: "2026-09-25T14:00:00Z", kind: "visit", by: "Ivo Kovač", note: "Test drive, Clio", amount: null },
  { id: 3, at: "2026-09-20T11:30:00Z", kind: "offer", by: "Ana Horvat", note: "Offer sent", amount: 14990 },
]);
const shown = ref<"all" | "none" | "loading">("all");
const rows = computed(() => (shown.value === "all" ? all.value : []));

const columns = computed(() => [
  { key: "at", label: t("customers.activity.when"), kind: "timestamp", width: 170, mobile: "meta" },
  { key: "kind", label: t("customers.activity.kind"), kind: "badge", tone: (row: Activity) => (row.kind === "offer" ? "positive" : "neutral"), text: (row: Activity) => t(`customers.activity.${row.kind}`), mobile: "accessory" },
  { key: "by", label: t("customers.activity.by"), hideBelow: "md", mobile: "meta" },
  { key: "note", label: t("customers.activity.note"), mobile: "primary" },
  { key: "amount", label: t("customers.activity.amount"), kind: "money", currency: "EUR", align: "end", hideBelow: "md", mobile: "meta" },
] satisfies TableColumns<Activity>);

const actionsOf = (row: Activity): RowAction[] => [
  { key: "open", label: t("customers.details"), icon: "eye", onSelect: () => toast.info(row.note) },
  { key: "remove", label: t("customers.activity.remove"), icon: "deleteBin2Line", tone: "critical", onSelect: () => toast.info(`${t("customers.activity.remove")} #${row.id}`) },
];
</script>

<template>
  <Panel :title="t('customers.activity.title')" flush data-test="customer-activity">
    <template #actions>
      <button v-for="option in (['all', 'none', 'loading'] as const)" :key="option" type="button" class="rounded px-2 py-1 text-footnote" :class="shown === option ? 'bg-tint-soft text-content-link' : 'text-content-muted'"
        @click="shown = option">{{ t(`customers.activity.show_${option}`) }}</button>
    </template>
    <DataTable :rows="rows" :columns="columns" :row-key="(row) => row.id" density="condensed" :loading="shown === 'loading'" :row-actions="actionsOf" :row-label="(row) => row.note">
      <template #actions="{ item }"><RowActions :actions="actionsOf(item)" /></template>
      <template #empty><p class="py-4 text-content-muted">{{ t("customers.activity.empty") }}</p></template>
    </DataTable>
  </Panel>
</template>
