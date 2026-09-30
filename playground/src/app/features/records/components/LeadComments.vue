<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "@wssto2/vue-core/button";
import { Panel } from "@wssto2/vue-core/content";
import { useResource } from "@wssto2/vue-core/resource";
import { AsyncSection } from "@wssto2/vue-core/state";
import { api } from "../api";

// An independent region: it observes the lead's identity explicitly, loads and retries on its own.
const props = defineProps<{ leadId: number }>();
const { t } = useI18n();
const comments = useResource({ for: () => props.leadId, load: (id, { signal }) => api.leads.comments(id, { signal }) });
const draft = ref("");

async function add() {
  if (!draft.value.trim()) return;
  await api.leads.addComment(props.leadId, draft.value.trim());
  draft.value = "";
  await comments.reload();
}
</script>

<template>
  <Panel :title="t('records.comments.title')">
    <AsyncSection :state="comments.state.value" :empty-title="t('records.comments.empty')" @retry="comments.reload()">
      <template #default="{ value }">
        <ul class="flex flex-col gap-2">
          <li v-for="comment in value" :key="comment.id" class="rounded-group bg-fill px-3 py-2 text-body"><strong>{{ comment.author }}</strong> {{ comment.text }}</li>
        </ul>
      </template>
    </AsyncSection>
    <template #footer>
      <form class="flex w-full gap-2" @submit.prevent="add">
        <input v-model="draft" :placeholder="t('records.comments.placeholder')" :aria-label="t('records.comments.placeholder')" class="min-w-0 flex-1 rounded-control bg-fill px-3 py-1.5" />
        <Button type="submit" prominence="secondary">{{ t("records.comments.add") }}</Button>
      </form>
    </template>
  </Panel>
</template>
