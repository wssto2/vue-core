<script setup lang="ts">
import { useCollectionNeighbors } from "@wssto2/vue-core/collection";
import { ResourcePage, useRouteResource } from "@wssto2/vue-core/resource";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import CustomerActivity from "../components/CustomerActivity.vue";
import { useCustomers } from "../context";
import { customerRoutes } from "../routes";

const { t } = useI18n();
const { api, list } = useCustomers();

const customer = useRouteResource({ param: "customerID", load: (id, { signal }) => api.get(id, signal) });

// The same definition as the list: back keeps the list's state and previous / next replays its query, filters and sort included.
const neighbors = useCollectionNeighbors(list, { current: () => customer.id.value, list: customerRoutes.index, param: "customerID", backLabel: () => t("customers.back") });
const title = computed(() => {
  const found = customer.data.value;
  if (!found) return t("customers.record", { id: customer.id.value ?? "" });
  return found.type === 2 ? found.company_name : `${found.first_name} ${found.last_name}`;
});
</script>

<template>
  <ResourcePage :resource="customer" :title="title" :list="neighbors.context">
    <template #default="{ record }">
      <dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-body">
        <dt class="text-content-muted">{{ t("customers.city") }}</dt><dd>{{ record.city }}</dd>
        <dt class="text-content-muted">E-mail</dt><dd>{{ record.email }}</dd>
      </dl>
      <CustomerActivity :customer-id="record.id" class="mt-6" />
    </template>
  </ResourcePage>
</template>
