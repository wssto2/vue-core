<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { CollectionPage, useCollection, type CollectionColumns } from "../../collection";
import { Avatar } from "../../content";
import { useFormat } from "../../format";
import type { UserRow } from "../../modules/identity/entities";
import type { PageAction } from "../../page";
import { usePlatform } from "../../platform";
import { Badge } from "../../state";
import { MANAGE_USERS } from "./access";
import { USER_VIEWS, userList } from "./list";
import NewUserDialog from "./NewUserDialog.vue";
import { usersRoutes } from "./routes";
import { statusTone } from "./status";

/**
 * The people who sign in: a list with the views Active / Locked / Inactive / All, search by name, login or e-mail, sorting
 * and paging, each row opening the person's record. "New user" (for whoever may manage users) asks for the required
 * fields in a dialog.
 */
const { t } = useI18n();
const { http, access } = usePlatform();
const format = useFormat();
const router = useRouter();
const dialog = useTemplateRef<InstanceType<typeof NewUserDialog>>("dialog");

const columns = computed(() => [
  { key: "name", label: t("core.users.columns.person"), kind: "identity", subtitle: (user: UserRow) => user.email, sort: "name", mobile: "primary" },
  { key: "login", label: t("core.users.columns.login"), sort: "login", hideBelow: "md", width: 180, mobile: "hidden" },
  { key: "last_sign_in", label: t("core.users.columns.last_sign_in"), width: 170, mobile: "meta" },
  { key: "status", label: t("core.users.columns.status"), width: 130, mobile: "accessory" },
] satisfies CollectionColumns<UserRow>);

const views = computed(() => USER_VIEWS.map((key) => ({ key, label: t(`core.users.views.${key}`) })));

const users = useCollection(userList(http), { columns, views, state: { kind: "url", key: "query" }, recordRoute: (user) => usersRoutes.record({ id: user.id }) });

const actions = computed<PageAction[]>(() =>
  access.can(MANAGE_USERS)
    ? [{ id: "create", label: t("core.users.create.title"), icon: "addLine", placement: "primary", compact: "icon", keyboardShortcut: { key: "N", ctrlKey: true }, onClick: () => dialog.value?.create() }]
    : [],
);
</script>

<template>
  <CollectionPage :collection="users" :title="t('core.users.title')" :description="t('core.users.description')" :actions="actions" :row-height="64"
    :row-label="(user) => user.name" views-presentation="scope">
    <template #leading="{ item }"><Avatar :name="item.name" size="md" tone="anchor" /></template>
    <template #cell-last_sign_in="{ item }">
      <time v-if="item.last_sign_in" :datetime="item.last_sign_in" class="text-body text-content">{{ format.dateTime(item.last_sign_in) }}</time>
      <span v-else class="text-body text-content-disabled">{{ t("core.users.never") }}</span>
    </template>
    <!-- A phone row says only what is not the ordinary: the badge of a locked or inactive person. -->
    <template #cell-status="{ item, compact }">
      <Badge v-if="!compact || item.status !== 'active'" :tone="statusTone(item.status)" dot>{{ t(`core.users.status.${item.status}`) }}</Badge>
    </template>
    <NewUserDialog ref="dialog" @created="(user) => router.push(usersRoutes.record({ id: user.id }))" />
  </CollectionPage>
</template>
