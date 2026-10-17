<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import type { SessionItem } from "../../modules/identity/entities";
import { identityRoutes } from "../../modules/identity/routes";
import { AlertDialog, toast } from "../../overlay";
import { usePlatform } from "../../platform";
import { AsyncSection, useLoad } from "../../state";
import { useServerMessages } from "../../i18n";
import SessionList from "../shared/SessionList.vue";
import { isSessionEnded } from "../signIn";

/**
 * The devices the person is signed in on. This one is marked and cannot be ended here (leaving it is signing out); every
 * other one can be signed out. A session somebody opened by signing in as the person is marked too.
 */
const { t } = useI18n();
const { http } = usePlatform();
const messages = useServerMessages();

const sessions = useLoad(async ({ signal }) => (await http.request(identityRoutes.profileSessions, undefined, { signal })).data);
const list = computed(() => sessions.data.value?.sessions ?? []);
const dialog = useTemplateRef<{ present: (session: SessionItem) => void }>("dialog");
const pending = ref<SessionItem | null>(null);

async function end(session: SessionItem) {
  try {
    await http.request(identityRoutes.profileRevokeSession, { session_id: session.id });
    toast.success(t("core.account.sessions.ended"));
  } catch (error) {
    if (!isSessionEnded(error)) toast.error(messages.sentence(error, t("core.account.sessions.end_failed")));
  }
  await sessions.reload();
}
</script>

<template>
  <div data-profile-sessions>
    <AsyncSection :state="sessions.state.value" :skeleton-rows="3" :is-empty="() => false" @retry="sessions.reload()">
      <SessionList :sessions="list" can-end :header="t('core.profile.sessions.title')" :footer="t('core.profile.sessions.footer')" @end="(session) => { pending = session; dialog?.present(session); }" />
    </AsyncSection>
    <AlertDialog ref="dialog" tone="critical" icon="logoutBoxRLine" :title="t('core.account.sessions.end_title')"
      :message="t('core.account.sessions.end_body', { device: pending?.device || t('core.account.sessions.unknown_device') })" :confirm-label="t('core.account.sessions.end')" :action="end" />
  </div>
</template>
