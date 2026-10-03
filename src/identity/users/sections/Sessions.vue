<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "../../../button";
import { useDescribeError } from "../../../i18n";
import type { SessionItem } from "../../../modules/identity/entities";
import { identityRoutes } from "../../../modules/identity/routes";
import { AlertDialog, toast } from "../../../overlay";
import { usePlatform } from "../../../platform";
import { useRouteResourceContext } from "../../../resource";
import { AsyncSection } from "../../../state";
import SectionIntro from "../../shared/SectionIntro.vue";
import SessionList from "../../shared/SessionList.vue";
import { isSessionEnded } from "../../signIn";
import { PERSON, usePersonActions, usePersonSessions } from "../person";

/**
 * The devices a person is signed in on, each with "Sign out", and "Sign out everywhere", which also ends the sessions
 * somebody opened by signing in as them. Ending one is felt at once: the next click on that device leads to the sign-in.
 * On one's own record the sessions are only listed: ending them all would end this one too, and one's own devices are
 * signed out in "my profile", where this one is marked and kept.
 */
const { t } = useI18n();
const { http } = usePlatform();
const describeError = useDescribeError();
const person = useRouteResourceContext(PERSON);
const actions = usePersonActions();
const sessions = usePersonSessions();

const one = useTemplateRef<{ present: (session: SessionItem) => void }>("one");
const all = useTemplateRef<{ present: () => void }>("all");

const list = computed(() => sessions.data.value?.sessions ?? []);

async function revoke(call: () => Promise<unknown>, done: string) {
  try {
    await call();
    toast.success(done);
  } catch (error) {
    if (!isSessionEnded(error)) toast.error(describeError(error, { fallback: t("core.account.sessions.end_failed") }));
  }
  await sessions.reload();
}

const endOne = (session: SessionItem) => revoke(() => http.request(identityRoutes.usersRevokeSession, { id: person.id.value ?? 0, session_id: session.id }), t("core.account.sessions.ended"));
const endAll = () => revoke(() => http.request(identityRoutes.usersRevokeSessions, { id: person.id.value ?? 0 }), t("core.users.sessions.ended_all"));
const pending = ref<SessionItem | null>(null);
</script>

<template>
  <div class="flex min-w-0 flex-col gap-group-gap" data-person-sessions>
    <SectionIntro :title="t('core.users.sections.sessions')" :description="t('core.users.intro.sessions', { name: person.data.value?.name ?? '' })">
      <template v-if="actions.can.endSessions && list.length > 0" #actions>
        <Button prominence="plain" tone="critical" data-end-all @click="all?.present()">{{ t("core.users.sessions.end_all") }}</Button>
      </template>
    </SectionIntro>

    <AsyncSection :state="sessions.state.value" :skeleton-rows="3" :is-empty="() => false" @retry="sessions.reload()">
      <SessionList :sessions="list" :can-end="actions.can.endSessions" :header="t('core.users.sessions.header', { n: list.length })"
        :footer="actions.can.endSessions ? t('core.users.sessions.footer') : t('core.users.sessions.own_footer')"
        @end="(session) => { pending = session; one?.present(session); }" />
    </AsyncSection>

    <AlertDialog ref="one" tone="critical" icon="logoutBoxRLine" :title="t('core.account.sessions.end_title')" :message="t('core.account.sessions.end_body', { device: pending?.device || t('core.account.sessions.unknown_device') })"
      :confirm-label="t('core.account.sessions.end')" :action="endOne" />
    <AlertDialog ref="all" tone="critical" icon="logoutBoxRLine" :title="t('core.users.sessions.end_all_title')" :message="t('core.users.sessions.end_all_body', { name: person.data.value?.name ?? '' })"
      :confirm-label="t('core.users.sessions.end_all')" :action="endAll" />
  </div>
</template>
