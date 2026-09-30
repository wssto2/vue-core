<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Avatar } from "@wssto2/vue-core/content";
import { RecordHeader } from "@wssto2/vue-core/page";
import { ResourcePage, useRouteResource, type RecordListContext } from "@wssto2/vue-core/resource";
import { AppRouterView } from "@wssto2/vue-core/router";
import { api, customerIds } from "../api";
import { CUSTOMER_RESOURCE } from "../context";
import { recordRoutes } from "../routes";

// The customer record: one section (so no navigation), opened from a list that it pages through.
const { t } = useI18n();
const customer = useRouteResource({ key: CUSTOMER_RESOURCE, param: "customerID", load: (id, { signal }) => api.customers.get(id, { signal }) });

// What a collection would supply: the list to go back to and the neighbours of this record in it.
const list = computed<RecordListContext>(() => {
  const at = customerIds.findIndex((id) => id === customer.id.value);
  const to = (id: number | undefined) => (id === undefined ? null : recordRoutes.customer({ customerID: id }));
  return {
    back: { label: t("records.customers"), to: recordRoutes.index },
    neighbors: at < 0 ? null : { position: at + 1, total: customerIds.length, previous: to(customerIds[at - 1]), next: to(customerIds[at + 1]) },
  };
});
</script>

<template>
  <ResourcePage :resource="customer" :title="customer.data.value?.name ?? t('records.customer')" :list="list">
    <template #header="{ record }">
      <RecordHeader :title="record.name" :subtitle="record.city" :quick-actions="[
        { id: 'call', label: t('records.actions.call'), icon: 'phoneLine', href: `tel:${record.phone}` },
        { id: 'mail', label: t('records.actions.mail'), icon: 'mailLine', href: `mailto:${record.email}` },
      ]">
        <template #leading><Avatar :name="record.name" size="xl" tone="anchor" /></template>
        <template #meta><span>{{ record.city }}</span></template>
      </RecordHeader>
    </template>
    <AppRouterView />
  </ResourcePage>
</template>
