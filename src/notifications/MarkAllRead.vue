<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Button } from "../button";
import type { Inbox } from "./inbox";

/** "Mark all as read": what has been seen, up to the newest id the inbox shows. Off while nothing is unread. */
defineProps<{ inbox: Inbox }>();
const { t } = useI18n();
</script>

<template>
  <Button prominence="plain" size="sm" icon="checkDoubleLine" data-notification-mark-all :disabled="inbox.unreadCount.value === 0" @click="inbox.markAllRead()">
    {{ t("core.notifications.mark_all_read") }}
  </Button>
</template>
