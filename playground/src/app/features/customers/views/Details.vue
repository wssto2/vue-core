<script setup lang="ts">
import { NeighborPager, useCollectionNeighbors } from "@wssto2/vue-core/collection";
import { AdaptivePageShell } from "@wssto2/vue-core/page";
import { computed, ref, watchEffect } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import type { Customer } from "../api";
import { useCustomers } from "../context";
import { customerRoutes } from "../routes";

const { t } = useI18n();
const route = useRoute();
const { api, list } = useCustomers();

const id = computed(() => Number(route.params.customerID));
const customer = ref<Customer | null>(null);
const failed = ref(false);
watchEffect((onCleanup) => {
  const controller = new AbortController();
  onCleanup(() => controller.abort());
  customer.value = null;
  failed.value = false;
  api.get(id.value, controller.signal).then((found) => (customer.value = found), () => (failed.value = !controller.signal.aborted));
});

// The same definition as the list: previous / next replays the list's query, filters and sort included.
const neighbors = useCollectionNeighbors(list, { current: () => id.value, list: customerRoutes.index, param: "customerID" });
const back = computed(() => ({ label: t("customers.back"), to: neighbors.listRoute.value ?? customerRoutes.index }));
const title = computed(() => (customer.value ? (customer.value.type === 2 ? customer.value.company_name : `${customer.value.first_name} ${customer.value.last_name}`) : t("customers.record", { id: id.value })));
</script>

<template>
  <AdaptivePageShell :title="title" :back="back" width="content">
    <template #pager><NeighborPager :neighbors="neighbors" /></template>
    <p v-if="failed" role="alert" class="text-content-destructive">{{ t("customers.failed") }}</p>
    <dl v-else-if="customer" class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-body">
      <dt class="text-content-muted">{{ t("customers.city") }}</dt><dd>{{ customer.city }}</dd>
      <dt class="text-content-muted">E-mail</dt><dd>{{ customer.email }}</dd>
    </dl>
  </AdaptivePageShell>
</template>
