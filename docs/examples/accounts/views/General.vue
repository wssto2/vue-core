<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { KeyValueList, Panel } from "@wssto2/vue-core/content";
import { useRouteResourceContext } from "@wssto2/vue-core/resource";
import { ACCOUNT } from "../context";

const { t } = useI18n();
const account = useRouteResourceContext(ACCOUNT); // the page's record: the section loads nothing
</script>

<template>
  <Panel v-if="account.data.value" :title="t('accounts.sections.general')">
    <KeyValueList :items="[{ key: 'plan', label: t('accounts.plan'), value: account.data.value.plan }]" />
  </Panel>
</template>
