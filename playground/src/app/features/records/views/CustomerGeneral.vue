<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { KeyValueList, Panel } from "@wssto2/vue-core/content";
import { useRouteResourceContext } from "@wssto2/vue-core/resource";
import { CUSTOMER_RESOURCE } from "../context";

const { t } = useI18n();
const customer = useRouteResourceContext(CUSTOMER_RESOURCE);
</script>

<template>
  <Panel v-if="customer.data.value" :title="t('records.sections.general')">
    <KeyValueList
      :columns="2"
      :items="[
        { key: 'name', label: t('records.fields.name'), value: customer.data.value.name },
        { key: 'city', label: t('records.fields.city'), value: customer.data.value.city },
        { key: 'phone', label: t('records.fields.phone'), value: customer.data.value.phone },
        { key: 'email', label: t('records.fields.email'), value: customer.data.value.email },
      ]" />
  </Panel>
</template>
