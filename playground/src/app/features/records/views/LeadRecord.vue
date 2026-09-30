<script setup lang="ts">
import { computed, provide } from "vue";
import { useI18n } from "vue-i18n";
import { Avatar, KeyValue, Panel } from "@wssto2/vue-core/content";
import { AdaptivePageShell, RecordHeader, SectionNavigator } from "@wssto2/vue-core/page";
import { useResource, useRouteResource } from "@wssto2/vue-core/resource";
import { AppRouterView } from "@wssto2/vue-core/router";
import { AsyncSection, Badge } from "@wssto2/vue-core/state";
import { api, outage } from "../api";
import LeadComments from "../components/LeadComments.vue";
import { LEAD_HISTORY, LEAD_RESOURCE } from "../context";
import { recordRoutes } from "../routes";

// A record page with a layout of its own: the shell, the header and the section navigator composed directly on the
// same resource. The phase history and the comments load on their own (and retry on their own): one failing never
// blanks the lead or the other.
const { t } = useI18n();
const lead = useRouteResource({ key: LEAD_RESOURCE, param: "leadID", load: (id, { signal }) => api.leads.get(id, { signal }) });
const history = useResource({ for: () => lead.id.value, load: (id, { signal }) => api.leads.history(id, { signal }) });
provide(LEAD_HISTORY, history);

const name = computed(() => lead.data.value?.name ?? t("records.lead"));
</script>

<template>
  <AdaptivePageShell :title="name" :back="{ label: t('records.leads'), to: recordRoutes.index }" :document-title="name">
    <template #header>
      <AsyncSection v-if="lead.state.value.status !== 'loaded' && lead.state.value.status !== 'refreshing'" :state="lead.state.value" @retry="lead.reload()" />
      <RecordHeader v-else-if="lead.data.value" :title="lead.data.value.name" :subtitle="lead.data.value.company">
        <template #leading><Avatar :name="lead.data.value.name" size="xl" tone="anchor" /></template>
        <template #meta><Badge tone="info" dot>{{ t(`records.lead_phases.${lead.data.value.phase}`) }}</Badge></template>
      </RecordHeader>
    </template>

    <!-- The phase track: its own region, so a failure shows a retry above it while the lead stays readable. -->
    <div class="flex min-w-0 flex-col gap-3">
      <AsyncSection :state="history.state.value" :skeleton-rows="1" @retry="history.reload()">
        <template #default="{ value }">
          <ol class="flex gap-2">
            <li v-for="event in value" :key="event.id"><Badge tone="positive" dot>{{ t(`records.lead_phases.${event.phase}`) }}</Badge></li>
          </ol>
        </template>
      </AsyncSection>
    </div>

    <!-- Wide: contact | sections | comments. Laptop: sections beside contact and comments. Phone: sections, contact, comments. -->
    <div class="grid min-w-0 grid-cols-1 items-start gap-section-gap lg:grid-cols-[17rem_minmax(0,1fr)] min-[90rem]:grid-cols-[17rem_minmax(0,1fr)_19rem]">
      <aside v-if="lead.data.value" class="flex min-w-0 flex-col gap-group-gap max-lg:order-2">
        <Panel :title="t('records.aside.customer')">
          <dl class="flex flex-col gap-3">
            <KeyValue :label="t('records.fields.email')" :value="lead.data.value.email" />
            <KeyValue :label="t('records.fields.phone')" :value="lead.data.value.phone" />
            <KeyValue :label="t('records.fields.company')" :value="lead.data.value.company" />
          </dl>
        </Panel>
      </aside>

      <SectionNavigator :label="t('records.sections.label')" desktop="segments" compact="segmented"
        class="max-lg:order-1 lg:col-start-2 lg:row-span-2 lg:row-start-1 min-[90rem]:row-span-1">
        <AppRouterView />
      </SectionNavigator>

      <LeadComments v-if="lead.data.value" :lead-id="lead.data.value.id"
        class="max-lg:order-3 lg:col-start-1 lg:row-start-2 min-[90rem]:col-start-3 min-[90rem]:row-start-1" />
    </div>

    <!-- Demo only: make each region fail on its own. -->
    <div class="flex flex-wrap gap-4 text-footnote text-content-muted">
      <label class="flex items-center gap-2"><input v-model="outage.history" type="checkbox" @change="history.reload()" />{{ t("records.history.outage") }}</label>
      <label class="flex items-center gap-2"><input v-model="outage.comments" type="checkbox" />{{ t("records.history.commentsOutage") }}</label>
    </div>
  </AdaptivePageShell>
</template>
