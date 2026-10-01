<script setup lang="ts">
// Type fixture (checked by `npm run typecheck`, never built): the slots of a DataTable are typed from
// the row and the columns, and a column cannot be sortable.
import DataTable from "./DataTable.vue";
import RowActions from "./RowActions.vue";
import type { TableColumns } from "./columns";

interface Order {
  readonly id: number;
  readonly name: string;
  readonly customer: { readonly name: string } | null;
}

const orders: Order[] = [];
const columns = [
  { key: "name", label: "Name", kind: "identity" },
  { key: "customer.name", label: "Customer", kind: "custom" },
] satisfies TableColumns<Order>;
const sortable = [
  // @ts-expect-error a table over an array keeps its order: no sort key
  { key: "name", label: "Name", sort: "name" },
] satisfies TableColumns<Order>;
</script>

<template>
  <DataTable :rows="orders" :columns="columns" :row-key="(order) => order.id" :row-class="(order) => (order.id === 0 ? 'x' : undefined)">
    <template #cell-customer_name="{ item, value }">{{ item.customer?.name }} {{ value?.toUpperCase() }}</template>
    <template #actions="{ item }"><RowActions :actions="[{ key: 'x', label: item.name, icon: 'eye' }]" /></template>
    <template #empty>Nothing</template>
    <template #cell-name="{ item }">
      <!-- @vue-expect-error the slot's row is an Order -->
      {{ item.nonexistent }}
    </template>
  </DataTable>
  <DataTable :rows="orders" :columns="columns" :row-key="(order) => order.id">
    <!-- @vue-expect-error there is no cell for a column the table does not have -->
    <template #cell-missing="{ item }">{{ item.id }}</template>
  </DataTable>
  <!-- @vue-expect-error a sortable column is not a table column -->
  <DataTable :rows="orders" :columns="sortable" :row-key="(order) => order.id" />
</template>
