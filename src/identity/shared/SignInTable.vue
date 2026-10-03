<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { DataTable, type TableColumns } from "../../collection";
import type { SignInRow } from "../../modules/identity/entities";
import { Badge } from "../../state";
import { signInEventKey, signInEventStyle } from "./signInEvents";

/**
 * A person's sign-in history as a table (rows below 1024 px): when, what happened as a badge (and who did it, for the events
 * somebody else does), from which device and which address. Shared by a person's record and by "my profile".
 */
const props = defineProps<{
  rows: readonly SignInRow[];
  loading?: boolean;
}>();

const { t } = useI18n();

const columns = computed(() => [
  { key: "created_at", label: t("core.account.signins.columns.time"), kind: "timestamp", width: 170, mobile: "meta" },
  { key: "event", label: t("core.account.signins.columns.event"), mobile: "primary" },
  { key: "device", label: t("core.account.signins.columns.device"), hideBelow: "md", width: 320, mobile: "hidden" },
  { key: "ip", label: t("core.account.signins.columns.ip"), hideBelow: "md", width: 140, mobile: "hidden" },
] satisfies TableColumns<SignInRow>);

const words = (row: SignInRow) => t(signInEventKey(row.event, row.actor?.name || null), { name: row.actor?.name ?? "" });
</script>

<template>
  <div class="overflow-hidden rounded-group bg-surface-cell shadow-group" data-signin-table>
    <DataTable :rows="props.rows" :columns="columns" :row-key="(row) => row.id" :loading="props.loading">
      <template #cell-event="{ item }"><Badge :tone="signInEventStyle(item.event).tone" :data-event="item.event">{{ words(item) }}</Badge></template>
      <template #cell-device="{ item }"><span class="block truncate" :title="item.device">{{ item.device || "—" }}</span></template>
      <template #cell-ip="{ item }"><span class="font-mono text-footnote">{{ item.ip || "—" }}</span></template>
      <template #empty><p class="px-4 py-8 text-center text-body text-content-muted" data-signin-empty>{{ t("core.account.signins.empty") }}</p></template>
    </DataTable>
  </div>
</template>
