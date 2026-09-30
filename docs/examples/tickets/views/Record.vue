<script setup lang="ts">
import { useCollectionNeighbors } from "@wssto2/vue-core/collection";
import { KeyValueList, Panel } from "@wssto2/vue-core/content";
import { ResourcePage, useRouteResource } from "@wssto2/vue-core/resource";
import { useI18n } from "vue-i18n";
import { useTickets } from "../context";
import { ticketRoutes } from "../routes";

const { t } = useI18n();
const { api, list } = useTickets();

// The record of the route's `:ticketID`: loaded on its own, a newer navigation drops an older answer.
const ticket = useRouteResource({ param: "ticketID", load: (id, { signal }) => api.get(id, signal) });

// Opened from the list? Then "back" returns to it with its state, and previous / next step through
// the same query (J / K and the arrows too). Opened by a direct link: back goes to the plain list.
const neighbors = useCollectionNeighbors(list, { current: () => ticket.id.value, list: ticketRoutes.index, param: "ticketID", backLabel: () => t("tickets.title") });
</script>

<template>
  <ResourcePage :resource="ticket" :title="ticket.data.value?.subject ?? t('tickets.record')" :list="neighbors.context">
    <template #default="{ record }">
      <Panel :title="t('tickets.details')">
        <KeyValueList
          :items="[
            { key: 'status', label: t('tickets.status'), value: t(`tickets.${record.status}`) },
            { key: 'assignee', label: t('tickets.assignee'), value: record.assignee },
          ]" />
      </Panel>
    </template>
  </ResourcePage>
</template>
