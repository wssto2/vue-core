<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Panel } from "@wssto2/vue-core/content";
import { AsyncSection } from "@wssto2/vue-core/state";
import { useLeadHistory } from "../context";

// The section shares the page's history read (its own retry lives in the page's region, and here too).
const { t } = useI18n();
const history = useLeadHistory();
</script>

<template>
  <Panel :title="t('records.history.title')">
    <AsyncSection :state="history.state.value" :empty-title="t('records.history.empty')" @retry="history.reload()">
      <template #default="{ value }">
        <ol class="flex flex-col gap-1">
          <li v-for="event in value" :key="event.id">{{ event.at }} · {{ t(`records.lead_phases.${event.phase}`) }}</li>
        </ol>
      </template>
    </AsyncSection>
  </Panel>
</template>
