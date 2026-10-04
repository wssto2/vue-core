<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { useCompactPresentation } from "../internal/mediaQuery";
import { Sheet } from "../modal";
import { Popover } from "../overlay";
import HeaderAction from "../shell/HeaderAction.vue";
import { useNotificationsContext } from "./context";
import InboxPanel from "./InboxPanel.vue";
import MarkAllRead from "./MarkAllRead.vue";
import SettingsLink from "./SettingsLink.vue";
import { unreadBadge } from "./state";

/**
 * The bell of the shell's header actions, with the number of unread notifications ("99+" past 99). It opens
 * the inbox as a popover on wide screens and as a bottom sheet on phones. Contributed by `notificationsFeature`.
 */
const { t } = useI18n();
const { inbox, settings } = useNotificationsContext();
const compact = useCompactPresentation();
const sheet = useTemplateRef<InstanceType<typeof Sheet>>("sheet");

const unread = computed(() => inbox.value?.unreadCount.value ?? 0);
const label = computed(() => (unread.value > 0 ? t("core.notifications.open_unread", { count: unread.value }) : t("core.notifications.open")));
const badge = computed(() => (unread.value > 0 ? unreadBadge(unread.value) : undefined));
</script>

<template>
  <template v-if="inbox">
    <Popover v-if="!compact" placement="bottom-start" width="auto" :arrow="false" :label="t('core.notifications.title')" @presented="inbox.load()">
      <template #trigger="{ toggle, attrs }">
        <HeaderAction v-bind="attrs" icon="notification3Line" :label="label" :badge="badge" data-notification-bell @click="toggle" />
      </template>
      <template #default="{ dismiss }">
        <InboxPanel :inbox="inbox" appearance="popover" @close="dismiss" />
      </template>
    </Popover>
    <template v-else>
      <HeaderAction icon="notification3Line" :label="label" :badge="badge" data-notification-bell @click="sheet?.present(); inbox.load()" />
      <Sheet ref="sheet" :title="t('core.notifications.title')">
        <template v-if="settings" #actions>
          <SettingsLink @click="sheet?.dismiss()" />
        </template>
        <InboxPanel :inbox="inbox" appearance="sheet" @close="sheet?.dismiss()" />
        <template #footer>
          <div class="flex items-center justify-center">
            <MarkAllRead :inbox="inbox" />
          </div>
        </template>
      </Sheet>
    </template>
  </template>
</template>
