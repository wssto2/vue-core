<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { AdaptivePageShell } from "../../page";
import { toast } from "../../overlay";
import { useServerMessages } from "../../i18n";
import { AsyncSection } from "../../state";
import SettingsBody from "./SettingsBody.vue";
import type { Channel } from "./state";
import { useSettings } from "./settings";

/**
 * The signed-in person's own notification settings: which categories reach them by e-mail and by push (each switch saves as it is
 * switched, and is taken back when the server refuses it), their quiet hours, push on this browser and their devices, and the
 * application's own sections. Needs a session, no permission.
 */
const { t } = useI18n();
const router = useRouter();
const messages = useServerMessages();
const settings = useSettings();

// Back to "My profile" only where the application installed it.
const back = computed(() => (router.hasRoute("profile") ? { label: t("core.profile.menu"), to: { name: "profile" } } : undefined));

async function change(category: string, channel: Channel, enabled: boolean) {
  try {
    await settings.setChannel(category, channel, enabled);
  } catch (error) {
    toast.error(messages.sentence(error, t("core.notifications.settings.email.save_failed")));
  }
}
</script>

<template>
  <AdaptivePageShell :title="t('core.notifications.settings.title')" :description="t('core.notifications.settings.description')" :back="back" width="readable">
    <AsyncSection :state="settings.loaded.state.value" :skeleton-rows="6" :is-empty="() => false" @retry="settings.loaded.reload()">
      <template #default="{ value }">
        <SettingsBody :preferences="value" :settings="settings" @change="change" />
      </template>
    </AsyncSection>
  </AdaptivePageShell>
</template>
