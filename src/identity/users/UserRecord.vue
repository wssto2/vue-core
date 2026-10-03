<script setup lang="ts">
import { computed, provide, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { useCollectionNeighbors } from "../../collection";
import { Avatar } from "../../content";
import { useDescribeError } from "../../i18n";
import { identityRoutes } from "../../modules/identity/routes";
import { AlertDialog, toast } from "../../overlay";
import { SectionNavigator, type PageAction } from "../../page";
import { usePlatform } from "../../platform";
import { ResourcePage, useRouteResource } from "../../resource";
import { AppRouterView } from "../../router";
import { Badge, useLoad } from "../../state";
import { isSessionEnded } from "../signIn";
import { MANAGE_USERS } from "./access";
import DeactivateDialog from "./DeactivateDialog.vue";
import { userList } from "./list";
import { PERSON, personActionsKey, personSessionsKey, type PersonActions } from "./person";
import { usersRoutes } from "./routes";
import SetPasswordDialog from "./SetPasswordDialog.vue";
import { statusTone } from "./status";

/**
 * A person's record: who they are above a source list of their sections in three groups (Person: details; Access: sign-in,
 * sessions; Activity: sign-in history, changes), the pager through the list they were opened from, and the actions that
 * change their state (deactivate, activate, set a password) behind `iam.user:manage`. The sections share the person
 * and these actions; the dialogs live here.
 */
const { t } = useI18n();
const { http, access, session } = usePlatform();
const describeError = useDescribeError();

const person = useRouteResource({
  key: PERSON,
  param: "id",
  load: async (id, { signal }) => (await http.request(identityRoutes.usersShow, { id }, { signal })).data,
});

// Counted beside "Sessions" and listed by the section; loaded once the person is.
const sessions = useLoad(
  async ({ signal }) => {
    const id = person.data.value?.id;
    return id === undefined ? { sessions: [] } : (await http.request(identityRoutes.usersSessions, { id }, { signal })).data;
  },
  { watch: () => person.data.value?.id },
);
provide(personSessionsKey, sessions);

const neighbors = useCollectionNeighbors(userList(http), { current: () => person.id.value, list: usersRoutes.index, param: "id", backLabel: () => t("core.users.title") });

const record = computed(() => person.data.value);
const own = computed(() => record.value !== null && session.state.value.status === "authenticated" && session.state.value.user.id === record.value.id);

const deactivateDialog = useTemplateRef<InstanceType<typeof DeactivateDialog>>("deactivateDialog");
const passwordDialog = useTemplateRef<InstanceType<typeof SetPasswordDialog>>("passwordDialog");
const activateDialog = useTemplateRef<{ present: () => void }>("activateDialog");

async function refresh() {
  await Promise.all([person.reload(), sessions.reload()]);
}

async function activate() {
  const id = person.id.value;
  if (id === null) return;
  try {
    await http.request(identityRoutes.usersActivate, { id });
    toast.success(t("core.users.activate.done", { name: record.value?.name ?? "" }));
  } catch (error) {
    if (!isSessionEnded(error)) toast.error(describeError(error, { fallback: t("core.users.activate.failed") }));
  }
  await refresh();
}

const can = computed<PersonActions["can"]>(() => {
  const manage = access.can(MANAGE_USERS);
  return { manage, deactivate: manage && !!record.value?.active && !own.value, activate: manage && record.value !== null && !record.value.active, endSessions: manage && !own.value };
});

provide(personActionsKey, {
  get can() {
    return can.value;
  },
  deactivate: () => deactivateDialog.value?.open(),
  activate: () => activateDialog.value?.present(),
  setPassword: () => passwordDialog.value?.open(),
  refresh,
});

const pageActions = computed<PageAction[]>(() => [
  ...(can.value.deactivate ? [{ id: "deactivate", label: t("core.users.actions.deactivate"), icon: "lockLine" as const, placement: "overflow" as const, tone: "critical" as const, onClick: () => deactivateDialog.value?.open() }] : []),
  ...(can.value.activate ? [{ id: "activate", label: t("core.users.actions.activate"), icon: "checkCircle" as const, placement: "overflow" as const, onClick: () => activateDialog.value?.present() }] : []),
]);

const counts = computed(() => ({
  ...(sessions.data.value ? { "users.record.sessions": sessions.data.value.sessions.length } : {}),
  ...(record.value?.status === "locked" ? { "users.record.signin": t("core.users.status.locked") } : {}),
}));
</script>

<template>
  <ResourcePage :resource="person" :title="record?.name ?? t('core.users.record')" :list="neighbors.context" :actions="pageActions">
    <template #default="{ record: loaded }">
      <SectionNavigator :label="t('core.users.sections_label')" desktop="sidebar" compact="rows" :back-label="loaded.name" :counts="counts">
        <template #summary>
          <div class="flex items-center gap-3 px-1.5" data-person-identity>
            <Avatar :name="loaded.name" size="lg" tone="anchor" />
            <div class="flex min-w-0 flex-col items-start gap-0.5">
              <span class="max-w-full truncate text-headline font-semibold text-content-strong">{{ loaded.name }}</span>
              <span class="max-w-full truncate text-footnote text-content-muted">{{ loaded.email }}</span>
              <Badge :tone="statusTone(loaded.status)" dot data-person-status>{{ t(`core.users.status.${loaded.status}`) }}</Badge>
            </div>
          </div>
        </template>
        <AppRouterView />
      </SectionNavigator>

      <DeactivateDialog ref="deactivateDialog" :id="loaded.id" :name="loaded.name" :session-count="sessions.data.value?.sessions.length ?? null" @done="refresh" />
      <SetPasswordDialog ref="passwordDialog" :id="loaded.id" :name="loaded.name" @saved="refresh" />
      <AlertDialog ref="activateDialog" icon="checkCircle" :title="t('core.users.activate.title')" :message="t('core.users.activate.body', { name: loaded.name })"
        :confirm-label="t('core.users.actions.activate')" :action="activate" />
    </template>
  </ResourcePage>
</template>
