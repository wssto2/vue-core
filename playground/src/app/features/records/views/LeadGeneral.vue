<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { KeyValueList, Panel } from "@wssto2/vue-core/content";
import { useRouteResourceContext } from "@wssto2/vue-core/resource";
import { LEAD_RESOURCE } from "../context";

const { t } = useI18n();
const lead = useRouteResourceContext(LEAD_RESOURCE);
</script>

<template>
  <Panel v-if="lead.data.value" :title="t('records.sections.general')">
    <KeyValueList :items="[
      { key: 'name', label: t('records.fields.name'), value: lead.data.value.name },
      { key: 'message', label: t('records.fields.message'), value: lead.data.value.message },
    ]" />
  </Panel>
</template>
