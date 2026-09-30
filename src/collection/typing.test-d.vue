<script setup lang="ts">
// Type fixture (checked by `npm run typecheck`, never built): the slots of a collection page are typed
// from the row and from the columns, without casts.
import { computed } from "vue";
import CollectionPage from "./CollectionPage.vue";
import type { CollectionColumns } from "./columns";
import { defineCollection } from "./definition";
import type { ListPage } from "./types";
import { useCollection } from "./useCollection";

interface Ticket {
  readonly id: number;
  readonly title: string;
  readonly status: "open" | "closed";
  readonly assignee: { readonly name: string } | null;
}

const empty: ListPage<Ticket> = { rows: [], total: 0, page: 1, pageSize: 25, lastPage: 0, from: 0, to: 0 };
const definition = defineCollection({
  id: "t",
  stateVersion: 1,
  load: async (): Promise<ListPage<Ticket>> => empty,
  key: (ticket) => ticket.id,
  query: { sorts: ["title"], filters: ["status"] },
});

const columns = computed(
  () =>
    [
      { key: "title", label: "Title", kind: "identity", sort: "title" },
      { key: "status", label: "Status", kind: "custom" },
      { key: "assignee.name", label: "Assignee", kind: "custom" },
    ] satisfies CollectionColumns<Ticket>,
);
const list = useCollection(definition, { columns, state: { kind: "memory" } });
</script>

<template>
  <CollectionPage :collection="list" title="Tickets">
    <template #cell-status="{ item, value, compact }">{{ item.title }} {{ value === "open" }} {{ compact }}</template>
    <template #cell-assignee_name="{ item, value }">{{ item.assignee?.name }} {{ value?.toUpperCase() }}</template>
    <template #leading="{ item }">{{ item.id }}</template>
    <template #actions="{ item }">{{ item.title }}</template>
    <template #cell-title="{ item }">
      <!-- @vue-expect-error the slot's row is a Ticket -->
      {{ item.nonexistent }}
    </template>
  </CollectionPage>
</template>
