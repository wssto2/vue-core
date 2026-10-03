<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Button } from "../button";
import { notificationSettingsRoutes } from "./settings/routes";

/** The gear of the inbox: the way to the person's notification settings. */
const emit = defineEmits<{ click: [] }>();
const { t } = useI18n();
</script>

<template>
  <Button prominence="plain" size="sm" icon="settings3Line" :to="notificationSettingsRoutes.index" v-bind="{ 'aria-label': t('core.notifications.settings.open'), title: t('core.notifications.settings.open') }" data-notification-settings @click="emit('click')" />
</template>
