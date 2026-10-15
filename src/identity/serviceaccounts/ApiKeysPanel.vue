<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "../../button";
import { IconTile } from "../../controls";
import { FormGroup, FormRow } from "../../form";
import { useFormat } from "../../format";
import type { ApiKey, CreatedApiKey, ServiceAccount } from "../../modules/serviceaccount/entities";
import { AlertDialog, toast } from "../../overlay";
import { usePlatform } from "../../platform";
import { useResource } from "../../resource";
import { AsyncSection, Badge } from "../../state";
import { MANAGE_ACCOUNTS, REVOKE_KEYS } from "./access";
import { useServiceAccountsApi } from "./api";
import CreatedApiKeyDialog from "./CreatedApiKeyDialog.vue";
import { useAccountMessages } from "./messages";
import NewApiKeyDialog from "./NewApiKeyDialog.vue";

/**
 * *API keys*: the keys a service account signs in with: name, the start of the key, who made it and when, last use, expiry, with *New API
 * key* (`iam.serviceaccount:manage`) and *Revoke* (`iam.serviceaccount:revoke`). Only the key's fingerprint is stored: a new key's secret is
 * shown once (`CreatedApiKeyDialog`) and never again; to replace one, make a new key, move the system over, then revoke the old.
 */
const props = defineProps<{ account: ServiceAccount }>();
const emit = defineEmits<{ changed: [] }>();

const { t } = useI18n();
const { access } = usePlatform();
const format = useFormat();
const api = useServiceAccountsApi();
const messages = useAccountMessages();

// The account's keys, read by its id: they start over for another account and stay on screen while they are read again.
const keys = useResource({ for: () => props.account.id, load: (id, { signal }) => api.keys(id, { signal }) });
const reload = () => keys.reload();

const newKey = useTemplateRef<InstanceType<typeof NewApiKeyDialog>>("newKey");
const createdKey = useTemplateRef<InstanceType<typeof CreatedApiKeyDialog>>("createdKey");
const revokeConfirm = useTemplateRef<{ present: () => void }>("revokeConfirm");
const pending = ref<ApiKey | null>(null);

const active = computed(() => !props.account.deactivated_at);
const canManage = computed(() => access.can(MANAGE_ACCOUNTS));
const canRevoke = computed(() => access.can(REVOKE_KEYS));
const isExpired = (key: ApiKey) => key.expires_at !== null && new Date(key.expires_at).getTime() < Date.now();

function sub(key: ApiKey): string {
  return [
    `${key.prefix}…`,
    t("core.serviceaccounts.keys.made_by", { name: key.created_by.name, date: format.date(key.created_at) }),
    key.last_used_at ? t("core.serviceaccounts.keys.last_used", { at: format.dateTime(key.last_used_at) }) : t("core.serviceaccounts.keys.never_used"),
    key.expires_at ? t("core.serviceaccounts.keys.expires", { date: format.date(key.expires_at) }) : t("core.serviceaccounts.keys.no_expiry"),
  ].join(" · ");
}

async function onDone() {
  await reload();
  emit("changed");
}

function askRevoke(key: ApiKey) {
  pending.value = key;
  revokeConfirm.value?.present();
}

async function revoke() {
  const key = pending.value;
  if (!key) return;
  await api.revokeKey(props.account.id, key.id);
  toast.success(t("core.serviceaccounts.keys.revoked_toast"));
  pending.value = null;
  await reload();
  emit("changed");
}

const revokeFailed = (error: unknown) => toast.error(messages.sentence(error, t("core.serviceaccounts.keys.errors.revoke")));
const created = (key: CreatedApiKey) => createdKey.value?.show(key);

defineExpose({ reload });
</script>

<template>
  <div class="flex min-w-0 flex-col gap-group-gap" data-test="api-keys">
    <AsyncSection :state="keys.state.value" :skeleton-rows="3" :is-empty="() => false" @retry="reload()">
      <template #default="{ value }">
        <FormGroup :header="t('core.serviceaccounts.keys.title')" :footer="t('core.serviceaccounts.keys.footer')">
          <FormRow v-if="value.length === 0" layout="setting" :label="t('core.serviceaccounts.keys.empty_title')" :sub="t('core.serviceaccounts.keys.empty_description')" />

          <FormRow v-for="key in value" :key="key.id" layout="setting" :label="key.name" :sub="sub(key)">
            <template #leading><IconTile :tone="key.revoked_at ? 'anchor' : 'brand'" icon="key2Line" /></template>
            <Badge v-if="key.revoked_at" tone="critical">{{ t("core.serviceaccounts.keys.revoked", { date: format.date(key.revoked_at) }) }}</Badge>
            <Badge v-else-if="isExpired(key)" tone="warning">{{ t("core.serviceaccounts.keys.expired") }}</Badge>
            <template v-if="canRevoke && !key.revoked_at" #trailing>
              <span class="contents" :data-test="`revoke-key-${key.id}`">
                <Button prominence="plain" tone="critical" size="sm" @click="askRevoke(key)">{{ t("core.serviceaccounts.keys.revoke") }}</Button>
              </span>
            </template>
          </FormRow>

          <FormRow v-if="canManage && active" layout="stacked">
            <span class="contents" data-test="new-api-key-action">
              <Button prominence="secondary" icon="addLine" @click="newKey?.show()">{{ t("core.serviceaccounts.keys.new") }}</Button>
            </span>
          </FormRow>
        </FormGroup>
      </template>
    </AsyncSection>

    <NewApiKeyDialog ref="newKey" :account="props.account" @created="created" />
    <CreatedApiKeyDialog ref="createdKey" :account="props.account" @done="onDone" />
    <AlertDialog ref="revokeConfirm" :title="t('core.serviceaccounts.keys.revoke_title')" :message="t('core.serviceaccounts.keys.revoke_body', { name: pending?.name ?? '', account: props.account.name })"
      :confirm-label="t('core.serviceaccounts.keys.revoke')" tone="critical" :action="revoke" @failed="revokeFailed" />
  </div>
</template>
