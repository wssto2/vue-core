<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { usePlatform } from "../platform";
import AccountMenuItem from "../shell/AccountMenuItem.vue";
import { CREATE_INCIDENTS } from "./access";
import { useIncidentsContext } from "./context";

/** The "Report a problem" row of the account menu, for whoever holds `incident:create`. */
const { t } = useI18n();
const { access } = usePlatform();
const incidents = useIncidentsContext();
</script>

<template>
  <AccountMenuItem v-if="access.can(CREATE_INCIDENTS)" :label="t('core.incidents.report_modal.menu')" icon="alertTriangle" data-incident-report-menu-item @click="incidents.reporting.value = true" />
</template>
