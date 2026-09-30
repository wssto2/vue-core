<script setup lang="ts">
import { useCollectionNeighbors } from "@wssto2/vue-core/collection";
import { AdaptivePageShell } from "@wssto2/vue-core/page";
import { RecordPager } from "@wssto2/vue-core/resource";
import { computed, ref, watchEffect } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import type { Lead } from "../api";
import { useLeads } from "../context";
import { leadRoutes } from "../routes";

const { t } = useI18n();
const route = useRoute();
const { api, list } = useLeads();

const id = computed(() => Number(route.params.leadID));
const lead = ref<Lead | null>(null);
const failed = ref(false);
watchEffect((onCleanup) => {
  const controller = new AbortController();
  onCleanup(() => controller.abort());
  lead.value = null;
  failed.value = false;
  api.get(id.value, controller.signal).then((found) => (lead.value = found), () => (failed.value = !controller.signal.aborted));
});

// Previous / next over the list the user came from: its search, filters, scope and sort travel in the link.
const neighbors = useCollectionNeighbors(list, { current: () => id.value, list: leadRoutes.index, param: "leadID", backLabel: () => t("leads.back") });
const title = computed(() => (lead.value ? `${lead.value.first_name} ${lead.value.last_name}` : t("leads.record", { id: id.value })));
</script>

<template>
  <AdaptivePageShell :title="title" :back="neighbors.context.back" width="content">
    <template v-if="neighbors.context.neighbors" #pager><RecordPager :neighbors="neighbors.context.neighbors" /></template>
    <p v-if="failed" role="alert" class="text-content-destructive">{{ t("leads.failed") }}</p>
    <p v-else-if="lead" class="text-body">{{ lead.email }}</p>
  </AdaptivePageShell>
</template>
