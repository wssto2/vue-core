<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "../../../button";
import { IconTile } from "../../../controls";
import { useFormat } from "../../../format";
import { FormGroup, FormRow } from "../../../form";
import { useDescribeError } from "../../../i18n";
import { identityRoutes } from "../../../modules/identity/routes";
import { toast } from "../../../overlay";
import { heldSession, usePlatform } from "../../../platform";
import { useRouteResourceContext } from "../../../resource";
import { Badge } from "../../../state";
import { isSessionEnded } from "../../signIn";
import SignInAsButton from "../../SignInAsButton.vue";
import ActionRow from "../../shared/ActionRow.vue";
import SectionIntro from "../../shared/SectionIntro.vue";
import { useUsersContext } from "../context";
import { PERSON, usePersonActions } from "../person";

/**
 * How a person signs in: the lock after too many wrong passwords (lifted by itself when its time ends, by "Unlock", or by a
 * new password), a new password set by an administrator (never read, only replaced), and signing in as them.
 */
const { t } = useI18n();
const { http, access, session } = usePlatform();
const format = useFormat();
const describeError = useDescribeError();
const { signInAs } = useUsersContext();
const person = useRouteResourceContext(PERSON);
const actions = usePersonActions();

const record = computed(() => person.data.value);
const locked = computed(() => record.value?.status === "locked");
const unlocking = ref(false);

// The same conditions as the button's own, so an empty group never shows.
const canSignInAs = computed(() => {
  const held = heldSession(session.state.value);
  return signInAs !== false && access.can(signInAs) && !!record.value?.active && held !== null && held.impersonator === undefined && held.user.id !== record.value.id;
});

async function unlock() {
  const id = person.id.value;
  if (id === null || unlocking.value) return;
  unlocking.value = true;
  try {
    await http.request(identityRoutes.usersUnlock, { id });
    toast.success(t("core.users.signin.unlocked"));
    await actions.refresh();
  } catch (error) {
    if (!isSessionEnded(error)) toast.error(describeError(error, { fallback: t("core.users.signin.unlock_failed") }));
  } finally {
    unlocking.value = false;
  }
}
</script>

<template>
  <div v-if="record" class="flex min-w-0 max-w-200 flex-col gap-group-gap" data-person-signin>
    <SectionIntro :title="t('core.users.sections.signin')" :description="t('core.users.intro.signin', { name: record.name })" />

    <FormGroup :header="t('core.users.signin.lock')" :footer="t('core.users.signin.lock_footer')">
      <FormRow layout="setting" :label="locked ? t('core.users.signin.locked_title') : t('core.users.signin.not_locked')"
        :sub="locked && record.locked_until ? t('core.users.signin.unlocks_at', { time: format.time(record.locked_until) }) : t('core.users.signin.not_locked_sub')" data-lock-row>
        <template #leading><IconTile :tone="locked ? 'anchor' : 'neutral'" icon="lockLine" /></template>
        <Badge v-if="locked" tone="critical" dot>{{ t("core.users.status.locked") }}</Badge>
        <template v-if="locked && actions.can.manage" #trailing>
          <Button size="sm" :processing="unlocking" data-unlock @click="unlock">{{ t("core.users.signin.unlock") }}</Button>
        </template>
      </FormRow>
    </FormGroup>

    <FormGroup v-if="actions.can.manage" :header="t('core.users.signin.password')" :footer="t('core.users.signin.password_footer')">
      <ActionRow :label="t('core.users.signin.set_password')" :sub="t('core.users.signin.set_password_sub')" data-set-password @click="actions.setPassword()" />
    </FormGroup>

    <FormGroup v-if="canSignInAs && signInAs !== false" :header="t('core.users.signin.as_header', { name: record.name })" :footer="t('core.users.signin.as_footer', { name: record.name })">
      <FormRow layout="setting" :label="t('core.users.signin.as_title')" :sub="t('core.users.signin.as_sub')">
        <template #trailing><SignInAsButton :user-id="record.id" :name="record.name" :permission="signInAs" /></template>
      </FormRow>
    </FormGroup>
  </div>
</template>
