<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { AdaptivePageShell } from "../../page";
import { toast } from "../../overlay";
import { useServerMessages } from "../../identity/fieldMessages";
import { AsyncSection } from "../../state";
import EmailPanel from "./EmailPanel.vue";
import QuietHoursPanel from "./QuietHoursPanel.vue";
import { useSettings } from "./settings";

/**
 * The signed-in person's own notification settings: which categories are e-mailed to them (each switch saves as it is
 * switched, and is taken back when the server refuses it) and their quiet hours. Needs a session, no permission.
 */
const { t } = useI18n();
const router = useRouter();
const messages = useServerMessages();
const settings = useSettings();

// Back to "My profile" only where the application installed it.
const back = computed(() => (router.hasRoute("profile") ? { label: t("core.profile.menu"), to: { name: "profile" } } : undefined));

async function change(category: string, enabled: boolean) {
  try {
    await settings.setEmail(category, enabled);
  } catch (error) {
    toast.error(messages.sentence(error, t("core.notifications.settings.email.save_failed")));
  }
}
</script>

<template>
  <AdaptivePageShell :title="t('core.notifications.settings.title')" :description="t('core.notifications.settings.description')" :back="back" width="content">
    <AsyncSection :state="settings.loaded.state.value" :skeleton-rows="6" :is-empty="() => false" @retry="settings.loaded.reload()">
      <template #default="{ value }">
        <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <EmailPanel :preferences="value" @change="change" />
          <QuietHoursPanel v-if="value.email_available" :quiet-hours="value.quiet_hours" :time-zone="value.time_zone" :submit="settings.saveQuietHours" />
        </div>
      </template>
    </AsyncSection>
  </AdaptivePageShell>
</template>
