<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AccountMenuItem from "../../shell/AccountMenuItem.vue";
import { notificationSettingsRoutes } from "./routes";

/** The entry of the account menu that opens the notification settings. */
const { t } = useI18n();
</script>

<template>
  <AccountMenuItem :label="t('core.notifications.settings.title')" icon="notification3Line" :to="notificationSettingsRoutes.index" data-notification-settings-menu-item />
</template>
