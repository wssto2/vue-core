<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useAccessLabels } from "../../access/labels";
import { CommandDialog, FormGroup, SelectField, TextareaField, TextField, useOptions, useRecordDialog, type FormValidator, type SelectOption, type ValidationIssue } from "../../form";
import type { ServiceAccount } from "../../modules/serviceaccount/entities";
import type { SaveInput } from "../../modules/serviceaccount/schemas";
import { toast } from "../../overlay";
import { usePlatform } from "../../platform";
import { MANAGE_ACCOUNTS } from "./access";
import { useServiceAccountsApi } from "./api";
import { useServiceAccountsContext } from "./context";
import { useAccountMessages } from "./messages";

/**
 * *New service account* / editing one: a name, a description, the tenant it belongs to (or the whole organization, for whoever
 * holds the permission there; only when the application has tenants) and the person who answers for it. An account has no password
 * and cannot sign in; it uses keys. The tenant and the people are read the first time the dialog opens.
 */
const emit = defineEmits<{ saved: [account: ServiceAccount] }>();

const { t } = useI18n();
const { access } = usePlatform();
const labels = useAccessLabels();
const api = useServiceAccountsApi();
const { tenants } = useServiceAccountsContext();
const messages = useAccountMessages();

/** An account of the whole organization is chosen as tenant 0 and sent as none; only whoever holds the permission outside every tenant may. */
const ORGANIZATION = 0;
const canOrganization = computed(() => {
  const held = access.held(MANAGE_ACCOUNTS);
  return held !== null && held.scope.id === undefined;
});

type Draft = { name: string; description: string; tenant_id: number | null; owner_id: number | null };
const blank = (value: string) => value.trim() === "";

const validator: FormValidator<SaveInput> = {
  safeParse(input) {
    const draft = input as Draft;
    const issues: ValidationIssue[] = [];
    const required = t("core.account.validation.required");
    const tooLong = t("core.serviceaccounts.errors.too_long");
    if (blank(draft.name)) issues.push({ path: ["name"], message: required });
    else if (draft.name.trim().length > 100) issues.push({ path: ["name"], message: tooLong });
    if (draft.description.length > 500) issues.push({ path: ["description"], message: tooLong });
    if (draft.owner_id === null) issues.push({ path: ["owner_id"], message: required });
    if (tenants !== null && draft.tenant_id === null) issues.push({ path: ["tenant_id"], message: required });
    if (issues.length > 0 || draft.owner_id === null) return { success: false, error: { issues } };
    return { success: true, data: { name: draft.name.trim(), description: draft.description, tenant_id: tenants === null ? null : draft.tenant_id || null, owner_id: draft.owner_id } };
  },
};

const account = useRecordDialog({
  ...messages,
  defaults: (): Draft => ({ name: "", description: "", tenant_id: tenants !== null && canOrganization.value ? ORGANIZATION : null, owner_id: null }),
  validator,
  toValues: (row: ServiceAccount): Draft => ({ name: row.name, description: row.description, tenant_id: row.tenant?.id ?? (canOrganization.value ? ORGANIZATION : null), owner_id: row.owner.id }),
  create: (input, { idempotencyKey }) => api.create(input, idempotencyKey),
  update: (row, input, { idempotencyKey }) => api.update(row.id, input, idempotencyKey),
  done: (saved) => {
    toast.success(t("core.serviceaccounts.toasts.saved"));
    emit("saved", saved);
  },
});
const form = account.form;

// Read once, the first time the dialog opens: a list the person may not use never asks.
const opened = ref(false);
const tenantOptions = useOptions<boolean, number>({
  for: () => (opened.value && tenants !== null ? true : null),
  load: async (_input, { signal }) => [
    ...(canOrganization.value ? [{ value: ORGANIZATION, label: labels.levelLabel("organization") }] : []),
    ...(await (tenants?.options(signal) ?? [])).map((tenant): SelectOption<number> => ({ value: tenant.id, label: tenant.name })),
  ],
});
const people = useOptions<boolean, number>({
  for: () => (opened.value ? true : null),
  load: async (_input, { signal }) => (await api.people({ signal })).map((person) => ({ value: person.id, label: person.name })),
});

function show(row?: ServiceAccount) {
  opened.value = true;
  if (row) account.edit(row);
  else account.create();
}

defineExpose({ show, form });
</script>

<template>
  <CommandDialog :command="account.command" size="md" :title="account.editing.value ? t('core.serviceaccounts.edit_title') : t('core.serviceaccounts.create_title')"
    :subtitle="t('core.serviceaccounts.no_password')" :confirm-label="t('core.serviceaccounts.save')">
    <div class="flex min-w-0 flex-col gap-group-gap" data-test="service-account-form">
      <FormGroup>
        <TextField v-bind="form.bind('name')" :label="t('core.serviceaccounts.fields.name')" :max-length="100" required />
        <TextareaField v-bind="form.bind('description')" :label="t('core.serviceaccounts.fields.description')" :rows="2" :max-length="500" />
      </FormGroup>

      <FormGroup :footer="t('core.serviceaccounts.fields.owner_hint')">
        <SelectField v-if="tenants" v-bind="form.bind('tenant_id')" :label="t(tenants.labelKey)" :options="tenantOptions" required />
        <SelectField v-bind="form.bind('owner_id')" :label="t('core.serviceaccounts.fields.owner')" :options="people" required />
      </FormGroup>
    </div>
  </CommandDialog>
</template>
