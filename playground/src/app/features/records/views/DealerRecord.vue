<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { IconTile } from "@wssto2/vue-core/controls";
import { RecordHeader, SectionNavigator } from "@wssto2/vue-core/page";
import { ResourcePage, useRouteResource } from "@wssto2/vue-core/resource";
import { AppRouterView } from "@wssto2/vue-core/router";
import { Badge } from "@wssto2/vue-core/state";
import { api } from "../api";
import { DEALER_RESOURCE } from "../context";
import { recordRoutes } from "../routes";

// The dealer record: sections as a source list beside the content (drill-in rows on phones).
const { t } = useI18n();
const dealer = useRouteResource({ key: DEALER_RESOURCE, param: "dealerID", load: (id, { signal }) => api.dealers.get(id, { signal }) });
const title = computed(() => dealer.data.value?.name ?? t("records.dealer"));
</script>

<template>
  <ResourcePage :resource="dealer" :title="title" :back="{ label: t('records.dealers'), to: recordRoutes.index }">
    <template #header="{ record }">
      <RecordHeader :title="record.name" :subtitle="`${record.code} · ${record.city}`">
        <template #leading><IconTile icon="box2Line" size="lg" /></template>
        <template #meta>
          <span>{{ record.code }} · {{ record.city }}</span>
          <Badge :tone="record.active ? 'positive' : 'neutral'" dot>{{ t(record.active ? "records.status.active" : "records.status.inactive") }}</Badge>
        </template>
      </RecordHeader>
    </template>
    <template #default="{ record }">
      <SectionNavigator :label="t('records.sections.label')" desktop="sidebar" compact="rows" :back-label="record.name">
        <AppRouterView />
      </SectionNavigator>
    </template>
  </ResourcePage>
</template>
