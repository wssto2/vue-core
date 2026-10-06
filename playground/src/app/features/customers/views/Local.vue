<script setup lang="ts">
import { CollectionPage, useCollection, type CollectionColumns, type FilterDescriptor } from "@wssto2/vue-core/collection";
import { EmptyState } from "@wssto2/vue-core/state";
import type { PageAction } from "@wssto2/vue-core/page";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { Customer } from "../api";
import { useCustomers } from "../context";
import { customerRoutes } from "../routes";

const { t } = useI18n();
const { list } = useCustomers();

const name = (customer: Customer) => (customer.type === 2 ? customer.company_name : `${customer.first_name} ${customer.last_name}`);
const columns = computed(() => [
  { key: "id", label: t("customers.name"), kind: "identity", title: name, mobile: "primary" },
  { key: "city", label: t("customers.city"), mobile: "meta" },
  { key: "created_at", label: t("customers.created"), kind: "timestamp", sort: "created_at", width: 150, mobile: "meta" },
] satisfies CollectionColumns<Customer>);
const filters = computed<FilterDescriptor<"city">[]>(() => [
  { key: "city", icon: "fileTextLine", label: t("customers.city"), type: "select", options: ["Dubrovnik", "Split", "Zagreb", "Rijeka", "Osijek", "Zadar"].map((value) => ({ value, label: value })) },
]);

// The list opens on the user's own location: nobody is entered there, so the first-use screen shows, not "no results".
const customers = useCollection(list, {
  columns,
  filters,
  state: { kind: "url", key: "query" },
  recordRoute: (customer: Customer) => customerRoutes.record({ customerID: customer.id }),
  defaults: { filters: { city: "Dubrovnik" } },
});

const actions = computed<PageAction[]>(() => [{ id: "reset", label: t("customers.reset"), icon: "refreshLine", placement: "secondary", onClick: () => customers.reset() }]);
</script>

<template>
  <CollectionPage :collection="customers" :title="t('customers.local_title')" :description="t('customers.local_description')" :actions="actions" :row-label="name">
    <template #empty><EmptyState :title="t('customers.first_use_title')" :description="t('customers.first_use_text')" /></template>
  </CollectionPage>
</template>
