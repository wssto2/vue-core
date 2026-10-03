<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "../../button";
import { KeyValue, Panel } from "../../content";
import { useFormat } from "../../format";
import type { PendingEmail, ProfileResponse } from "../../modules/identity/entities";
import { identityRoutes } from "../../modules/identity/routes";
import { toast } from "../../overlay";
import { usePlatform } from "../../platform";
import { Banner } from "../../state";
import { useServerMessages } from "../fieldMessages";
import { isSessionEnded } from "../signIn";
import EmailChangeDialog from "./EmailChangeDialog.vue";

/** The current address, "Change e-mail address", and a change that waits for its code, to resume or cancel. */
const props = defineProps<{ profile: ProfileResponse }>();
const emit = defineEmits<{ updated: [profile: ProfileResponse] }>();

const { t } = useI18n();
const { http } = usePlatform();
const format = useFormat();
const messages = useServerMessages();

const dialog = useTemplateRef<InstanceType<typeof EmailChangeDialog>>("dialog");
const cancelling = ref(false);
const pending = computed(() => props.profile.pending_email);
const withPending = (next: PendingEmail | null) => emit("updated", { ...props.profile, pending_email: next });

async function cancelPending() {
  if (cancelling.value) return;
  cancelling.value = true;
  try {
    await http.request(identityRoutes.profileCancelEmail);
    toast.success(t("core.profile.email.cancelled"));
    withPending(null);
  } catch (error) {
    if (!isSessionEnded(error)) toast.error(messages.sentence(error, t("core.profile.email.cancel_failed")));
  } finally {
    cancelling.value = false;
  }
}
</script>

<template>
  <Panel :title="t('core.profile.email.title')" icon="mailUnreadFill" data-profile-email>
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <dl><KeyValue :label="t('core.profile.email.current')" :value="props.profile.email" data-profile-email-current /></dl>
      <Button icon="mailUnreadFill" data-email-change @click="dialog?.present(null)">{{ t("core.profile.email.change") }}</Button>
    </div>

    <Banner v-if="pending" tone="info" class="mt-4" data-email-pending>
      <p>{{ t("core.profile.email.pending", { email: pending.email }) }}</p>
      <p class="text-footnote">{{ t("core.profile.email.valid_until", { time: format.time(pending.expires_at) }) }}</p>
      <div class="mt-2 flex flex-wrap gap-2">
        <Button size="sm" prominence="primary" data-email-enter-code @click="dialog?.present(pending)">{{ t("core.profile.email.enter_code") }}</Button>
        <Button size="sm" :processing="cancelling" data-email-cancel @click="cancelPending">{{ t("core.profile.email.cancel_change") }}</Button>
      </div>
    </Banner>

    <EmailChangeDialog ref="dialog" @pending="withPending" @changed="emit('updated', $event)" @cancelled="withPending(null)" />
  </Panel>
</template>
