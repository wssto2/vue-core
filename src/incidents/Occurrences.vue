<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "../button";
import { Panel } from "../content";
import { useFormat } from "../format";
import type { OccurrenceResponse } from "../modules/incident/entities";
import { AsyncSection, useLoad } from "../state";
import { useIncidentsApi } from "./api";
import Person from "./Person.vue";

/**
 * An incident's occurrences (staff only: the caller shows it for `incident:manage`), newest first, a page at a time. Each opens to its stack
 * and the context and request the server kept (read-only JSON).
 */
const props = defineProps<{ incidentId: number }>();
const { t } = useI18n();
const format = useFormat();
const api = useIncidentsApi();

const page = ref(1);
const list = useLoad((ctx) => api.occurrences(props.incidentId, page.value, ctx), { watch: [page, () => props.incidentId] });
const meta = computed(() => (list.data.value ? list.data.value.meta : undefined));
const lastPage = computed(() => meta.value?.last_page ?? 1);

const open = ref(new Set<number>());
const toggle = (id: number) => (open.value.has(id) ? open.value.delete(id) : open.value.add(id), (open.value = new Set(open.value)));
const json = (value: unknown) => JSON.stringify(value, null, 2);
const where = (item: OccurrenceResponse) => [item.method, item.route].filter(Boolean).join(" ");
const kind = (item: OccurrenceResponse) => [item.error_class, item.error_code].filter(Boolean).join(" · ");
const hasContext = (value: unknown) => value !== undefined && value !== null && !(typeof value === "object" && Object.keys(value as object).length === 0);
</script>

<template>
  <Panel :title="t('core.incidents.details.occurrences')" flush data-test="incident-occurrences">
    <AsyncSection :state="list.state.value" :empty-title="t('core.incidents.details.no_occurrences')" empty-icon="fileTextLine" :is-empty="(value) => value.rows.length === 0" @retry="list.reload()">
      <template #default="{ value }">
        <div v-for="item in value.rows" :key="item.id" class="p-4 not-last:border-b not-last:border-border-separator" data-test="incident-occurrence-item">
          <div class="mb-1 flex flex-wrap items-center justify-between gap-3">
            <span class="text-xs text-content-muted">{{ format.dateTime(item.occurred_at) }}</span>
            <span v-if="where(item)" class="font-mono text-xs text-content">{{ where(item) }}</span>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <Person v-if="item.user" :person="item.user" />
            <span v-if="item.request_id" class="font-mono text-footnote text-content-muted">{{ item.request_id }}</span>
          </div>
          <p v-if="kind(item)" class="mt-2 font-mono text-xs text-content-strong">{{ kind(item) }}</p>
          <p class="whitespace-pre-line text-sm text-content">{{ item.message }}</p>
          <Button prominence="plain" size="xs" @click="toggle(item.id)">
            {{ t(open.has(item.id) ? "core.incidents.details.hide_details" : "core.incidents.details.show_details") }}
          </Button>
          <div v-if="open.has(item.id)" class="mt-2 flex flex-col gap-3" data-test="incident-occurrence-details">
            <pre v-if="item.stacktrace" class="overflow-x-auto whitespace-pre-wrap rounded-control bg-fill p-3 font-mono text-xs">{{ item.stacktrace }}</pre>
            <div v-if="hasContext(item.context)">
              <h6 class="mb-1 text-footnote font-semibold uppercase text-content-muted">{{ t("core.incidents.details.context") }}</h6>
              <pre class="overflow-x-auto whitespace-pre-wrap rounded-control bg-fill p-3 font-mono text-xs">{{ json(item.context) }}</pre>
            </div>
            <div v-if="hasContext(item.request)">
              <h6 class="mb-1 text-footnote font-semibold uppercase text-content-muted">{{ t("core.incidents.details.request") }}</h6>
              <pre class="overflow-x-auto whitespace-pre-wrap rounded-control bg-fill p-3 font-mono text-xs">{{ json(item.request) }}</pre>
            </div>
          </div>
        </div>
        <div v-if="lastPage > 1" class="flex items-center justify-between gap-3 border-t border-border-separator p-3">
          <Button prominence="secondary" size="sm" :disabled="page <= 1" @click="page--">{{ t("core.collection.page.previous") }}</Button>
          <span class="text-xs text-content-muted">{{ t("core.collection.page.page_of", { current: page, total: lastPage }) }}</span>
          <Button prominence="secondary" size="sm" :disabled="page >= lastPage" @click="page++">{{ t("core.collection.page.next") }}</Button>
        </div>
      </template>
    </AsyncSection>
  </Panel>
</template>
