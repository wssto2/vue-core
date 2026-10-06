<script setup lang="ts">
import { CollectionPage, useCollection, useDatePresetFilter, type CollectionColumns, type FilterDescriptor, type RowAction, type ViewDescriptor } from "@wssto2/vue-core/collection";
import { Avatar } from "@wssto2/vue-core/content";
import { useFormat } from "@wssto2/vue-core/format";
import { Badge, type Tone } from "@wssto2/vue-core/state";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import type { Lead } from "../api";
import { useLeads } from "../context";
import { leadRoutes } from "../routes";

const { t } = useI18n();
const format = useFormat();
const router = useRouter();
const { list, savedViews } = useLeads();

const name = (lead: Lead) => `${lead.first_name} ${lead.last_name}`;
const contact = (lead: Lead) => lead.email || lead.mobile_phone;
const recordOf = (lead: Lead) => leadRoutes.record({ leadID: lead.id });
const PHASE_TONES: Record<number, Tone> = { 1: "neutral", 2: "info", 3: "info", 4: "warning", 5: "warning", 6: "critical" };
// The tones of the phase badges, for the dots of the phase filter's options.
const PHASE_DOTS: Record<string, Tone> = { open: "info", 1: "neutral", 2: "info", 3: "info", 4: "warning", 5: "warning", 6: "critical", "7_bought": "positive", "7_rejected": "neutral" };
const phaseTone = (lead: Lead): Tone => (lead.phase.phase === 7 ? (lead.phase.decision === "bought" ? "positive" : "neutral") : (PHASE_TONES[lead.phase.phase] ?? "neutral"));
const phaseText = (lead: Lead) => (lead.phase.phase === 7 ? `${t("leads.phases.7")} | ${t(`leads.closed.${lead.phase.decision ?? "rejected"}`)}` : t(`leads.phases.${lead.phase.phase}`));
const overdue = (lead: Lead) => lead.next_contact_at !== null && Date.parse(lead.next_contact_at) < Date.UTC(2026, 8, 30, 12);

// Name and phase on the first phone line, date, city, assignee, next step and source below.
const columns = computed(() => [
  { key: "first_name", label: t("leads.columns.name"), kind: "identity", title: name, subtitle: contact, sort: "first_name", mobile: "primary" },
  { key: "city", label: t("leads.columns.city"), hideBelow: "md", mobile: "meta" },
  { key: "created_at", label: t("leads.columns.created"), kind: "timestamp", sort: "created_at", width: 160, hideBelow: "md", mobile: "meta" },
  { key: "phase", label: t("leads.columns.phase"), kind: "custom", width: 210, mobile: "accessory" },
  { key: "phase.assigned_to", label: t("leads.columns.assigned"), kind: "custom", width: 170, hideBelow: "md", mobile: "meta" },
  { key: "next_contact_at", label: t("leads.columns.next"), kind: "custom", width: 150, mobile: "meta" },
  { key: "heard_from", label: t("leads.columns.heard"), kind: "badge", tone: () => "context", text: (lead: Lead) => t(`leads.heard.${lead.heard_from}`), width: 150, hideBelow: "md", mobile: "meta" },
] satisfies CollectionColumns<Lead>);

const filters = computed<FilterDescriptor<"phase" | "assigned_to" | "followup" | "created_at">[]>(() => [
  useDatePresetFilter("created_at"),
  { key: "assigned_to", icon: "phoneLine", label: t("leads.filters.assigned"), type: "select", options: [{ value: "none", label: t("leads.filters.none") }, { value: 1, label: "Ana Horvat" }, { value: 2, label: "Marko Babić" }, { value: 3, label: "Iva Knežević" }] },
  { key: "followup", icon: "mailLine", label: t("leads.filters.followup"), type: "select", options: [{ value: "overdue", label: t("leads.filters.overdue"), dot: "critical" }, { value: "today", label: t("leads.filters.today"), dot: "warning" }, { value: "none", label: t("leads.filters.without"), dot: "neutral" }] },
  { key: "phase", icon: "fileTextLine", label: t("leads.filters.phase"), type: "select", placement: "panel", options: ["open", "1", "2", "3", "4", "5", "6", "7_bought", "7_rejected"].map((value) => ({ value, label: t(`leads.phases.${value}`), dot: PHASE_DOTS[value] })) },
]);

const leads = useCollection(list, {
  columns,
  filters,
  views: computed<ViewDescriptor<"all" | "mine">[]>(() => [{ key: "all", label: t("leads.views.all") }, { key: "mine", label: t("leads.views.mine") }]),
  state: { kind: "url", key: "query" },
  recordRoute: recordOf,
  savedViews,
  // Links from a home page count: /leads?followup=overdue&mine=1
  linked: { params: { followup: "followup", phase: "phase", mine: { filter: "assigned_to", value: () => "1" } } },
});

// Call and e-mail for the channels the lead has, then the record.
function rowActions(lead: Lead): RowAction[] {
  const actions: RowAction[] = [];
  const phone = lead.mobile_phone?.replace(/\s+/g, "");
  if (phone) actions.push({ key: "call", label: t("leads.call"), icon: "phoneLine", href: `tel:${phone}`, tone: "positive", section: "contact" });
  if (lead.email) actions.push({ key: "email", label: t("leads.email"), icon: "mailLine", href: `mailto:${lead.email}`, tone: "info", section: "contact" });
  actions.push({ key: "view", label: t("leads.details"), icon: "fileTextLine", section: "record", onSelect: () => void router.push(recordOf(lead)) });
  return actions;
}
</script>

<template>
  <CollectionPage :collection="leads" :title="t('leads.title')" :description="t('leads.description')" :row-actions="rowActions" :row-label="name" :row-height="56"
    views-presentation="scope">
    <template #leading="{ item }"><Avatar :name="name(item)" size="md" /></template>

    <template #cell-phase="{ item }"><Badge :tone="phaseTone(item)" dot>{{ phaseText(item) }}</Badge></template>

    <template #cell-phase_assigned_to="{ item, compact }">
      <span v-if="item.phase.agent" class="inline-flex items-center gap-1.5"><Avatar :name="item.phase.agent.name" :size="compact ? 'xs' : 'sm'" />{{ item.phase.agent.name }}</span>
      <span v-else class="text-content-disabled">{{ t("leads.unassigned") }}</span>
    </template>

    <!-- Overdue in the danger tone, nothing without a follow-up. -->
    <template #cell-next_contact_at="{ item, value, compact }">
      <span v-if="value" class="tabular-nums" :class="overdue(item) ? 'font-semibold text-content-destructive' : ''">
        <template v-if="overdue(item)">{{ t("leads.overdue") }} · </template>{{ format.date(value) }}
      </span>
      <span v-else-if="!compact" class="text-content-disabled">—</span>
    </template>
  </CollectionPage>
</template>
