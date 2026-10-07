<script setup lang="ts">
import { CollectionTable, useCollection, type CollectionColumns } from "@wssto2/vue-core/collection";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { Customer } from "../api";
import { useCustomers } from "../context";

// The list inside the picker dialog. The dialog mounts it each time it opens, so it starts clean.
const emit = defineEmits<{ pick: [customer: Customer] }>();

const { t } = useI18n();
const { list } = useCustomers();

const name = (customer: Customer) => (customer.type === 2 ? customer.company_name : `${customer.first_name} ${customer.last_name}`);
const columns = computed(() => [
  { key: "id", label: t("customers.name"), kind: "identity", title: name, subtitle: (customer: Customer) => customer.email || customer.phone, mobile: "primary" },
  { key: "city", label: t("customers.city"), width: 160, mobile: "accessory" },
] satisfies CollectionColumns<Customer>);

// Memory state: the search stays out of the URL, and a row is a choice, not a link to a record.
const customers = useCollection(list, { columns, state: { kind: "memory" } });
</script>

<template>
  <CollectionTable :collection="customers" :pick="(customer) => emit('pick', customer)" :pick-label="t('customers.pick_label')" />
</template>
