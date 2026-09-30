<script setup lang="ts">
// Type fixture, checked by the playground's `vue-tsc` against the packed declarations: what the record slots
// receive is the record itself, non-null, and the resource's type flows into them. Never rendered.
import { ResourcePage, useRouteResource } from "@wssto2/vue-core/resource";
import { api } from "./api";

const dealer = useRouteResource({ param: "dealerID", load: (id, { signal }) => api.dealers.get(id, { signal }) });
</script>

<template>
  <ResourcePage :resource="dealer" title="Dealer">
    <template #header="{ record }">{{ record.name.length }}</template>
    <template #default="{ record }">
      <!-- @vue-expect-error a property the dealer does not have -->
      {{ record.model }}
      {{ record.city.toUpperCase() }}
    </template>
  </ResourcePage>
  <!-- @vue-expect-error a resource is needed, not a number -->
  <ResourcePage :resource="42" title="Dealer" />
</template>
