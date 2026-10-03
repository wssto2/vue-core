<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { IconTile } from "../controls";
import { FormGroup, FormRow } from "../form";
import { useDescribeError } from "../i18n";
import type { Role, RoleSummary } from "../modules/access/entities";
import { AlertDialog, toast } from "../overlay";
import { RecordHeader } from "../page";
import type { PageAction } from "../page";
import { usePlatform } from "../platform";
import { ResourcePage, useResource, useRouteResource } from "../resource";
import { AsyncSection, Badge } from "../state";
import { useAccessApi } from "./api";
import { accessPermissions, useAccessContext } from "./context";
import { useAccessLabels } from "./labels";
import ReplaceRoleDialog from "./ReplaceRoleDialog.vue";
import RoleCompareDialog from "./RoleCompareDialog.vue";
import RoleEditor from "./RoleEditor.vue";
import { accessPages } from "./routes";

/**
 * A role's page: the editor of a custom role, or the read-only page of a predefined or computed one with *Copy*. A custom role
 * also has *Compare with a predefined role*, *Replace* (its holders move to a predefined role) and *Delete* (refused while anyone
 * holds it). Under the editor: who holds the role, and where.
 */
const { t } = useI18n();
const router = useRouter();
const { access } = usePlatform();
const labels = useAccessLabels();
const describeError = useDescribeError();
const { subjectRoute } = useAccessContext();
const api = useAccessApi();

const role = useRouteResource<Role, string>({ param: "ref", parse: (raw) => (raw === "" ? null : raw), identify: (value) => value.ref, load: (ref, { signal }) => api.role(ref, { signal }) });
const holders = useResource({ for: role, load: (ref, { signal }) => api.holders(ref, { signal }) });

const others = ref<readonly RoleSummary[]>([]);
const compareDialog = useTemplateRef<{ present: () => void }>("compareDialog");
const replaceDialog = useTemplateRef<{ present: () => void }>("replaceDialog");
const deleteDialog = useTemplateRef<{ present: (subject: Role) => void }>("deleteDialog");

const isCustom = (value: Role) => !value.predefined && !value.computed;

// Compare and Replace offer every predefined role a custom one can become (the computed ones included); the server decides what may be given.
async function withOthers(open: () => void) {
  if (others.value.length === 0) {
    try {
      others.value = (await api.roles()).filter((candidate) => candidate.predefined);
    } catch (error) {
      toast.error(describeError(error));
      return;
    }
  }
  open();
}

const actions = computed<PageAction[]>(() => {
  const value = role.data.value;
  if (!value) return [];
  const list: PageAction[] = [];
  if (access.can(accessPermissions.manageRoles)) list.push({ id: "copy", label: t("core.access.copy"), icon: "copy", placement: "secondary", onClick: () => void router.push({ ...accessPages.newRole, query: { copy: value.ref } }) });
  if (isCustom(value) && access.can(accessPermissions.manageRoles)) {
    list.push({ id: "compare", label: t("core.access.compare.action"), icon: "swapBoxLine", placement: "overflow", onClick: () => void withOthers(() => compareDialog.value?.present()) });
    list.push({ id: "replace", label: t("core.access.replace.action"), icon: "refreshLine", placement: "overflow", onClick: () => void withOthers(() => replaceDialog.value?.present()) });
  }
  if (isCustom(value) && access.can(accessPermissions.deleteRoles)) list.push({ id: "delete", label: t("core.access.delete.action"), icon: "deleteBin2Line", placement: "overflow", tone: "critical", onClick: () => deleteDialog.value?.present(value) });
  return list;
});

async function remove(value: Role) {
  await api.remove(value.ref);
  toast.success(t("core.access.deleted"));
  await router.replace(accessPages.roles);
}
const deleteFailed = (error: unknown) => toast.error(describeError(error, { fallback: t("core.access.delete.failed") }));
</script>

<template>
  <ResourcePage :resource="role" :title="role.data.value ? labels.roleName(role.data.value) : ''" :back="{ label: t('core.access.title'), to: accessPages.roles }" :actions="actions">
    <template #header="{ record }">
      <RecordHeader :title="labels.roleName(record)" :subtitle="record.description">
        <template #leading><IconTile :tone="record.predefined ? 'anchor' : 'brand'" icon="shieldStarFill" size="lg" /></template>
        <template #meta>
          <Badge :tone="record.predefined ? 'neutral' : 'info'">{{ labels.roleKind(record) }}</Badge>
          <span data-test="role-holders">{{ t("core.access.holders_count", { count: record.holders }) }}</span>
        </template>
      </RecordHeader>
    </template>

    <template #default="{ record }">
      <div class="flex min-w-0 flex-col gap-group-gap">
        <RoleEditor :role="record" @saved="role.update($event); void holders.reload()" />

        <AsyncSection :state="holders.state.value" :skeleton-rows="3" :is-empty="() => false" @retry="holders.reload()">
          <template #default="{ value }">
            <FormGroup :header="t('core.access.holders.title')" :footer="value.length ? undefined : t('core.access.holders.empty')">
              <FormRow v-for="holder in value" :key="`${holder.subject.kind}-${holder.subject.id}`" layout="setting" :label="holder.name" :sub="labels.scopeLabel(holder.scope)"
                :to="subjectRoute(holder.subject) ?? undefined">
                <Badge v-if="holder.subject.kind === 'service'" tone="neutral">{{ t("core.access.holders.service") }}</Badge>
              </FormRow>
            </FormGroup>
          </template>
        </AsyncSection>

        <template v-if="isCustom(record)">
          <RoleCompareDialog ref="compareDialog" :role="record" :others="others" />
          <ReplaceRoleDialog ref="replaceDialog" :role="record" :others="others" @replaced="role.reload(); holders.reload()" />
          <AlertDialog ref="deleteDialog" tone="critical" :title="t('core.access.delete.title')" :message="t('core.access.delete.body', { name: labels.roleName(record) })"
            :confirm-label="t('core.access.delete.action')" :action="remove" @failed="deleteFailed" />
        </template>
      </div>
    </template>
  </ResourcePage>
</template>
