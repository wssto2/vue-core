<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { CollectionPage, RecordIdentity, useCollection, useDatePresetFilter, type CollectionColumns, type FilterDescriptor } from "../collection";
import { Timestamp } from "../content";
import { IconTile } from "../controls";
import { useFormat } from "../format";
import type { Incident } from "../modules/incident/entities";
import type { PageAction } from "../page";
import { usePlatform } from "../platform";
import { Badge } from "../state";
import { CREATE_INCIDENTS } from "./access";
import { incidentList, type IncidentFilter, type IncidentSort } from "./api";
import { SEVERITY_LABELS, SEVERITY_TONES, SOURCE_LABELS, STATUS_LABELS, STATUS_TONES } from "./look";
import ReportDialog from "./ReportDialog.vue";
import { incidentsRoutes } from "./routes";

/**
 * The incidents: server errors captured as they happen, errors the browser reported and the reports people filed, last seen first.
 * The server decides which a person sees (the staff all of them, anybody else their own and the ones they watch). A row opens the
 * incident; *Report a bug* (`incident:create`) opens the report and, once filed, the incident it opened or joined.
 */
const { t } = useI18n();
const router = useRouter();
const { http, access } = usePlatform();
const format = useFormat();
const report = useTemplateRef<InstanceType<typeof ReportDialog>>("report");

const columns = computed(() => [
  { key: "title", label: t("core.incidents.table_columns.title"), sort: "title", mobile: "primary" },
  { key: "severity", label: t("core.incidents.table_columns.severity"), width: 110, align: "center", mobile: "meta" },
  { key: "status", label: t("core.incidents.table_columns.status"), width: 130, align: "center", mobile: "accessory" },
  { key: "source", label: t("core.incidents.table_columns.source"), width: 130, align: "center", mobile: "hidden" },
  { key: "report_count", label: t("core.incidents.table_columns.report_count"), width: 90, align: "center", mobile: "hidden" },
  { key: "occurrence_count", label: t("core.incidents.table_columns.occurrence_count"), width: 90, align: "center", mobile: "hidden" },
  { key: "last_seen_at", label: t("core.incidents.table_columns.last_seen_at"), sort: "last_seen_at", width: 150, align: "center", mobile: "meta" },
] satisfies CollectionColumns<Incident, IncidentSort>);

const selectFilter = (key: IncidentFilter, icon: FilterDescriptor["icon"], label: string, labels: Readonly<Record<string, string>>): FilterDescriptor<IncidentFilter> => ({
  key, icon, label, type: "select", options: Object.entries(labels).map(([value, text]) => ({ label: t(text), value })),
});

// Made once at setup: it reads the i18n composer, which exists only while the component is set up.
const dateFilter = useDatePresetFilter<IncidentFilter>("created_at");
const filters = computed<FilterDescriptor<IncidentFilter>[]>(() => [
  dateFilter.value,
  selectFilter("status", "checkCircle", t("core.incidents.table_filters.status"), STATUS_LABELS),
  selectFilter("severity", "alertTriangle", t("core.incidents.table_filters.severity"), SEVERITY_LABELS),
  selectFilter("source", "gitRepositoryCommitsFill", t("core.incidents.table_filters.source"), SOURCE_LABELS),
]);

const incidents = useCollection(incidentList(http), {
  columns, filters, state: { kind: "url", key: "query" },
  recordRoute: (incident) => incidentsRoutes.details({ incidentID: incident.id }),
});

const actions = computed<PageAction[]>(() => (access.can(CREATE_INCIDENTS) ? [{
  id: "create", label: t("core.incidents.actions.report"), icon: "alertTriangle", placement: "primary", compact: "icon",
  keyboardShortcut: { key: "N", ctrlKey: true }, onClick: () => void report.value?.show(),
}] : []));

const onCreated = (incident: Incident) => void router.push(incidentsRoutes.details({ incidentID: incident.id }));
</script>

<template>
  <CollectionPage :collection="incidents" :title="t('core.incidents.title')" :description="t('core.incidents.description')" icon="alertTriangle" :actions="actions" :row-height="61">
    <template #leading><IconTile tone="brand" weight="soft" size="sm" icon="alertTriangle" /></template>

    <!-- On the phone the public code leads the quiet line (severity), so the row stays two lines. -->
    <template #cell-title="{ item, compact, to }">
      <RecordIdentity v-if="compact" :title="item.title" :to="to" :highlight="incidents.query.value.search" />
      <div v-else class="flex min-w-0 items-center gap-3">
        <IconTile tone="brand" weight="soft" size="sm" icon="alertTriangle" />
        <RecordIdentity :title="item.title" :subtitle="item.public_code" :to="to" :highlight="incidents.query.value.search" subtitle-selectable />
      </div>
    </template>

    <template #cell-severity="{ item, compact }">
      <span v-if="compact" class="shrink-0 tabular-nums">{{ item.public_code }}</span>
      <Badge :tone="SEVERITY_TONES[item.severity] ?? 'neutral'">{{ t(SEVERITY_LABELS[item.severity] ?? item.severity) }}</Badge>
    </template>

    <template #cell-status="{ item }">
      <Badge :tone="STATUS_TONES[item.status] ?? 'neutral'" dot>{{ t(STATUS_LABELS[item.status] ?? item.status) }}</Badge>
    </template>

    <template #cell-source="{ item }">
      <span class="text-xs">{{ t(SOURCE_LABELS[item.source] ?? item.source) }}</span>
    </template>

    <template #cell-last_seen_at="{ item, compact }">
      <span v-if="compact" class="tabular-nums">{{ format.date(item.last_seen_at) }}</span>
      <Timestamp v-else :value="item.last_seen_at" />
    </template>

    <ReportDialog ref="report" @created="onCreated" />
  </CollectionPage>
</template>
