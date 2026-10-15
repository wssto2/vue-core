<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { PersonAccess } from "../../access";
import { useAccessLabels } from "../../access/labels";
import { IconTile, Tabs, type TabItem } from "../../controls";
import { FormGroup, FormRow } from "../../form";
import { useFormat } from "../../format";
import { AlertDialog, toast } from "../../overlay";
import { RecordHeader, type PageAction } from "../../page";
import { usePlatform } from "../../platform";
import { ResourcePage, useRouteResource } from "../../resource";
import { Badge } from "../../state";
import { MANAGE_ACCOUNTS } from "./access";
import { useServiceAccountsApi } from "./api";
import ApiKeysPanel from "./ApiKeysPanel.vue";
import { useServiceAccountsContext } from "./context";
import { useAccountMessages } from "./messages";
import { serviceAccountsRoutes } from "./routes";
import ServiceAccountDialog from "./ServiceAccountDialog.vue";

/**
 * A service account (`/iam/service-accounts/:id`): its data (who answers for it, the tenant), its *Access* (the same panel as a person's) and
 * its *API keys*, in tabs (`?tab=general | access | keys`). An account has no password and cannot sign in; it calls the API with `X-API-Key`.
 * Deactivating it stops its keys and cannot be undone.
 */
const { t } = useI18n();
const route = useRoute();
const { access } = usePlatform();
const format = useFormat();
const labels = useAccessLabels();
const api = useServiceAccountsApi();
const { tenants } = useServiceAccountsContext();
const messages = useAccountMessages();

// The account from the route: a validated id, no stale account across ids, not found and a retryable failure told apart.
const resource = useRouteResource({ param: "id", load: (id, { signal }) => api.show(id, { signal }) });
const account = resource.data;

const TABS = ["general", "access", "keys"] as const;
type TabName = (typeof TABS)[number];
const asked = typeof route.query.tab === "string" ? route.query.tab : "";
const tab = ref<TabName>((TABS as readonly string[]).includes(asked) ? (asked as TabName) : "general");
const roleCount = ref<number | null>(null);

const editDialog = useTemplateRef<InstanceType<typeof ServiceAccountDialog>>("editDialog");
const deactivateConfirm = useTemplateRef<{ present: () => void }>("deactivateConfirm");

const canManage = computed(() => access.can(MANAGE_ACCOUNTS));
const isActive = computed(() => account.value !== null && !account.value.deactivated_at);
const tenantName = computed(() => account.value?.tenant?.name ?? labels.levelLabel("organization"));

const tabs = computed<TabItem[]>(() => [
  { value: "general", label: t("core.serviceaccounts.tabs.general"), icon: "settings3Line" },
  { value: "access", label: t("core.serviceaccounts.tabs.access"), icon: "shieldStarFill", ...(roleCount.value !== null ? { badge: roleCount.value } : {}) },
  { value: "keys", label: t("core.serviceaccounts.tabs.keys"), icon: "key2Line", badge: account.value?.active_keys ?? 0 },
]);

const actions = computed<PageAction[]>(() => {
  const current = account.value;
  if (!current || !canManage.value || !isActive.value) return [];
  return [
    { id: "edit", label: t("core.serviceaccounts.actions.edit"), icon: "edit", placement: "secondary", onClick: () => editDialog.value?.show(current) },
    { id: "deactivate", label: t("core.serviceaccounts.actions.deactivate"), icon: "lockLine", placement: "overflow", tone: "critical", onClick: () => deactivateConfirm.value?.present() },
  ];
});

async function deactivate() {
  if (!account.value) return;
  resource.update(await api.deactivate(account.value.id));
  toast.success(t("core.serviceaccounts.toasts.deactivated"));
}
const deactivateFailed = (error: unknown) => toast.error(messages.sentence(error, t("core.serviceaccounts.errors.deactivate")));
</script>

<template>
  <ResourcePage :resource="resource" :title="account?.name || t('core.serviceaccounts.title')" :back="{ label: t('core.serviceaccounts.title_plural'), to: serviceAccountsRoutes.index }"
    :actions="actions" width="content">
    <template #header="{ record }">
      <RecordHeader :title="record.name" :subtitle="tenants ? tenantName : undefined">
        <template #leading><IconTile tone="anchor" icon="key2Line" size="lg" /></template>
        <template #meta>
          <Badge tone="context">{{ t("core.serviceaccounts.title") }}</Badge>
          <span v-if="tenants">{{ tenantName }}</span>
          <Badge v-if="!isActive" tone="neutral">{{ t("core.serviceaccounts.deactivated") }}</Badge>
        </template>
      </RecordHeader>
    </template>

    <template #default="{ record }">
      <div class="flex min-w-0 flex-col gap-group-gap">
        <Tabs v-model="tab" :tabs="tabs" />

        <div v-if="tab === 'general'" class="flex min-w-0 flex-col gap-group-gap" data-test="service-general">
          <FormGroup :footer="t('core.serviceaccounts.no_password')">
            <FormRow layout="value" :label="t('core.serviceaccounts.fields.owner')" :value="record.owner.name" />
            <FormRow v-if="tenants" layout="value" :label="t(tenants.labelKey)" :value="tenantName" />
            <FormRow v-if="record.description" layout="value" :label="t('core.serviceaccounts.fields.description')" :value="record.description" />
            <FormRow layout="value" :label="t('core.serviceaccounts.made_by')" :value="`${record.created_by.name}, ${format.date(record.created_at)}`" />
            <FormRow layout="value" :label="t('core.serviceaccounts.last_call_label')" :value="record.last_used_at ? format.dateTime(record.last_used_at) : t('core.serviceaccounts.never_used')" />
            <FormRow layout="value" :label="t('core.serviceaccounts.status')"
              :value="record.deactivated_at ? t('core.serviceaccounts.deactivated_on', { date: format.date(record.deactivated_at) }) : t('core.serviceaccounts.active')" />
          </FormGroup>
        </div>

        <PersonAccess v-else-if="tab === 'access'" :subject="{ kind: 'service', id: record.id }" :name="record.name" :subject-label="tenants ? `${record.name} · ${tenantName}` : record.name"
          @loaded="(n: number) => (roleCount = n)" />

        <ApiKeysPanel v-else :account="record" @changed="resource.reload()" />
      </div>

      <ServiceAccountDialog ref="editDialog" @saved="resource.update($event)" />
      <AlertDialog ref="deactivateConfirm" :title="t('core.serviceaccounts.deactivate_title')" :message="t('core.serviceaccounts.deactivate_body', { name: record.name })"
        :confirm-label="t('core.serviceaccounts.actions.deactivate')" tone="critical" :action="deactivate" @failed="deactivateFailed" />
    </template>
  </ResourcePage>
</template>
