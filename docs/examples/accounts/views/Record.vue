<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { IconTile } from "@wssto2/vue-core/controls";
import { RecordHeader, SectionNavigator } from "@wssto2/vue-core/page";
import { ResourcePage, useRouteResource } from "@wssto2/vue-core/resource";
import { AppRouterView } from "@wssto2/vue-core/router";
import { Badge } from "@wssto2/vue-core/state";
import { useAccountsApi, ACCOUNT } from "../context";

const { t } = useI18n();
const api = useAccountsApi();

// `key` provides the resource to the routed sections below (they read it with useRouteResourceContext).
const account = useRouteResource({ key: ACCOUNT, param: "accountID", load: (id, { signal }) => api.get(id, signal) });
const title = computed(() => account.data.value?.name ?? t("accounts.record"));
</script>

<template>
  <ResourcePage :resource="account" :title="title" :back="{ label: t('accounts.title'), to: '/' }">
    <template #header="{ record }">
      <RecordHeader :title="record.name" :subtitle="record.plan">
        <template #leading><IconTile icon="ticketLine" size="lg" /></template>
        <template #meta><Badge :tone="record.active ? 'positive' : 'neutral'" dot>{{ t(record.active ? "accounts.active" : "accounts.inactive") }}</Badge></template>
      </RecordHeader>
    </template>
    <template #default="{ record }">
      <!-- The sections of the route, as a source list beside the content on desktop and drill-in rows on a phone. -->
      <SectionNavigator :label="t('accounts.sections.label')" desktop="sidebar" compact="rows" :back-label="record.name">
        <AppRouterView />
      </SectionNavigator>
    </template>
  </ResourcePage>
</template>
