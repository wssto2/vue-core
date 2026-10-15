<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useAccessLabels } from "../../access/labels";
import { IconTile, Tabs, type TabItem } from "../../controls";
import { FormGroup, FormRow, TextField } from "../../form";
import { useFormat } from "../../format";
import type { ServiceAccount } from "../../modules/serviceaccount/entities";
import { AdaptivePageShell, type PageAction } from "../../page";
import { usePlatform } from "../../platform";
import { AsyncSection, Badge, useLoad } from "../../state";
import { MANAGE_ACCOUNTS } from "./access";
import { useServiceAccountsApi } from "./api";
import { useServiceAccountsContext } from "./context";
import { serviceAccountsRoutes } from "./routes";
import ServiceAccountDialog from "./ServiceAccountDialog.vue";

/**
 * Service accounts: the systems that reach the API with keys and cannot sign in. Each row says whose they are (the tenant, when the
 * application has them), who answers for them, how many keys are live and when one was last used; the views are Active / Inactive / All and a
 * search reads name, description and the responsible person. The server decides which accounts the person sees (an administrator of a tenant
 * sees the tenant's). A row opens the account's record; *New service account* opens it where the roles and the first key are given.
 */
const { t } = useI18n();
const router = useRouter();
const { access } = usePlatform();
const format = useFormat();
const labels = useAccessLabels();
const api = useServiceAccountsApi();
const { tenants } = useServiceAccountsContext();

const dialog = useTemplateRef<InstanceType<typeof ServiceAccountDialog>>("dialog");
const accounts = useLoad(({ signal }) => api.list({ signal }));
const view = ref<"active" | "inactive" | "all">("active");
const search = ref("");

const all = computed<readonly ServiceAccount[]>(() => accounts.data.value ?? []);
const isActive = (account: ServiceAccount) => account.deactivated_at === null;
const tenantOf = (account: ServiceAccount) => account.tenant?.name ?? labels.levelLabel("organization");

// The views count under the same search, as the other lists' views do.
const found = computed(() => {
  const needle = search.value.trim().toLowerCase();
  return all.value.filter((account) => needle === "" || `${account.name} ${account.description} ${account.owner.name}`.toLowerCase().includes(needle));
});
const shown = computed(() => found.value.filter((account) => view.value === "all" || (view.value === "active") === isActive(account)));

const tabs = computed<TabItem[]>(() => [
  { value: "active", label: t("core.serviceaccounts.views.active"), badge: found.value.filter(isActive).length },
  { value: "inactive", label: t("core.serviceaccounts.views.inactive"), badge: found.value.filter((account) => !isActive(account)).length },
  { value: "all", label: t("core.serviceaccounts.views.all"), badge: found.value.length },
]);

const actions = computed<PageAction[]>(() =>
  access.can(MANAGE_ACCOUNTS)
    ? [{ id: "create", label: t("core.serviceaccounts.create"), icon: "addLine", placement: "primary", compact: "icon", keyboardShortcut: { key: "N", ctrlKey: true }, onClick: () => dialog.value?.show() }]
    : [],
);

function sub(account: ServiceAccount): string {
  return [
    account.description,
    ...(tenants ? [tenantOf(account)] : []),
    account.owner.name,
    account.last_used_at ? t("core.serviceaccounts.last_call", { at: format.dateTime(account.last_used_at) }) : t("core.serviceaccounts.never_used"),
  ].filter(Boolean).join(" · ");
}

// A new account has no roles and no key yet: open it where they are given.
const onSaved = (account: ServiceAccount) => void router.push({ ...serviceAccountsRoutes.record({ id: account.id }), query: { tab: "access" } });
</script>

<template>
  <AdaptivePageShell :title="t('core.serviceaccounts.title_plural')" :description="t('core.serviceaccounts.description')" icon="key2Line" :count="all.length || null" :actions="actions">
    <div class="flex min-w-0 flex-col gap-group-gap" data-test="service-segment">
      <div class="flex flex-wrap items-center gap-3">
        <Tabs v-model="view" :tabs="tabs" presentation="scope" />
        <TextField v-model="search" class="min-w-[14rem] flex-1" :label="t('core.serviceaccounts.search')" label-hidden :placeholder="t('core.serviceaccounts.search')" />
      </div>

      <AsyncSection :state="accounts.state.value" :skeleton-rows="4" :is-empty="() => false" @retry="accounts.reload()">
        <div data-test="service-accounts">
          <FormGroup :footer="t('core.serviceaccounts.no_password')">
            <p v-if="shown.length === 0" class="px-row-inset py-6 text-center text-body text-content-muted" data-test="service-accounts-empty">{{ t("core.serviceaccounts.empty") }}</p>

            <FormRow v-for="account in shown" :key="account.id" layout="setting" :label="account.name" :sub="sub(account)" :to="serviceAccountsRoutes.record({ id: account.id })" :data-service-account="account.id">
              <template #leading><IconTile tone="anchor" icon="key2Line" /></template>
              <Badge v-if="!isActive(account)" tone="neutral">{{ t("core.serviceaccounts.deactivated") }}</Badge>
              <span v-else class="min-w-[4.5rem] text-right text-footnote tabular-nums text-content-muted" data-test="account-keys">{{ t("core.serviceaccounts.active_keys", { count: account.active_keys }) }}</span>
            </FormRow>
          </FormGroup>
        </div>
      </AsyncSection>
    </div>

    <ServiceAccountDialog v-if="access.can(MANAGE_ACCOUNTS)" ref="dialog" @saved="onSaved" />
  </AdaptivePageShell>
</template>
