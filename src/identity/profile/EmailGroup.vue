<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "../../button";
import { IconTile } from "../../controls";
import { useFormat } from "../../format";
import { FormGroup, FormRow } from "../../form";
import type { PendingEmail, ProfileResponse } from "../../modules/identity/entities";
import { identityRoutes } from "../../modules/identity/routes";
import { toast } from "../../overlay";
import { usePlatform } from "../../platform";
import { useServerMessages } from "../fieldMessages";
import { isSessionEnded } from "../signIn";
import EmailChangeDialog from "./EmailChangeDialog.vue";

/** The current address with "Change", and below it a change that waits for its code, to resume or cancel. */
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
  <FormGroup :header="t('core.profile.email.title')" data-profile-email>
    <FormRow layout="setting" :label="t('core.profile.email.current')" :sub="props.profile.email" data-profile-email-current>
      <template #leading><IconTile tone="anchor" icon="mailUnreadFill" /></template>
      <template #trailing><Button size="sm" data-email-change @click="dialog?.present(null)">{{ t("core.profile.email.change") }}</Button></template>
    </FormRow>
    <FormRow v-if="pending" layout="setting" :label="t('core.profile.email.pending', { email: pending.email })" :sub="t('core.profile.email.valid_until', { time: format.time(pending.expires_at) })" data-email-pending>
      <template #leading><IconTile tone="neutral" icon="timeLine" /></template>
      <template #trailing>
        <Button size="sm" prominence="primary" data-email-enter-code @click="dialog?.present(pending)">{{ t("core.profile.email.enter_code") }}</Button>
        <Button size="sm" :processing="cancelling" data-email-cancel @click="cancelPending">{{ t("core.profile.email.cancel_change") }}</Button>
      </template>
    </FormRow>
  </FormGroup>
  <EmailChangeDialog ref="dialog" @pending="withPending" @changed="emit('updated', $event)" @cancelled="withPending(null)" />
</template>
