<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "@wssto2/vue-core/button";
import { KeyValueList, Panel } from "@wssto2/vue-core/content";
import { useRouteResourceContext } from "@wssto2/vue-core/resource";
import { api } from "../api";
import { DEALER_RESOURCE } from "../context";

// A routed section: reads the page's record from the typed context and hands a save's answer back.
const { t } = useI18n();
const dealer = useRouteResourceContext(DEALER_RESOURCE);
const saving = ref(false);

async function rename(id: number, name: string) {
  saving.value = true;
  try {
    // The save can finish after the user has moved on to another dealer: `update` ignores it then.
    dealer.update(await api.dealers.rename(id, name));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Panel v-if="dealer.data.value" :title="t('records.sections.general')">
    <KeyValueList
      :columns="2"
      :items="[
        { key: 'name', label: t('records.fields.name'), value: dealer.data.value.name },
        { key: 'code', label: t('records.fields.code'), value: dealer.data.value.code },
        { key: 'city', label: t('records.fields.city'), value: dealer.data.value.city },
      ]" />
    <template #footer>
      <Button prominence="secondary" :processing="saving" @click="rename(dealer.data.value.id, `${dealer.data.value.name} ✎`)">{{ t("records.actions.rename") }}</Button>
    </template>
  </Panel>
</template>
