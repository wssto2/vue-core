<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { CommandDialog, DateField, FormGroup, TextField, useCommand, type FormValidator } from "../../form";
import type { CreatedApiKey, ServiceAccount } from "../../modules/serviceaccount/entities";
import type { KeyRequest } from "../../modules/serviceaccount/schemas";
import { useServiceAccountsApi } from "./api";
import { expiryOf, todayOf } from "./form";
import { useAccountMessages } from "./messages";

/**
 * *New API key*: a name (where the key is used) and an optional expiry. The key is made on the server and its secret comes back once,
 * which the page then shows in `CreatedApiKeyDialog`.
 */
const props = defineProps<{ account: ServiceAccount }>();
const emit = defineEmits<{ created: [created: CreatedApiKey] }>();

const { t } = useI18n();
const api = useServiceAccountsApi();
const messages = useAccountMessages();

type Draft = { name: string; expires: string | null };

const validator: FormValidator<KeyRequest> = {
  safeParse(input) {
    const { name, expires } = input as Draft;
    return name.trim() === ""
      ? { success: false, error: { issues: [{ path: ["name"], message: t("core.account.validation.required") }] } }
      : { success: true, data: { name: name.trim(), expires_at: expiryOf(expires) } };
  },
};

const key = useCommand({
  ...messages,
  defaults: (): Draft => ({ name: "", expires: null }),
  validator,
  // The server's complaint about `expires_at` belongs to the field called `expires`.
  serverField: (field) => (field === "expires_at" ? "expires" : field),
  run: (input, { idempotencyKey }) => api.createKey(props.account.id, input, idempotencyKey),
  done: (created) => emit("created", created),
});

defineExpose({ show: () => key.present(), form: key.form });
</script>

<template>
  <CommandDialog :command="key" size="md" :title="t('core.serviceaccounts.keys.new_title')" :subtitle="props.account.name" :confirm-label="t('core.serviceaccounts.keys.create')">
    <div class="flex min-w-0 flex-col gap-group-gap" data-test="new-api-key">
      <FormGroup :footer="t('core.serviceaccounts.keys.new_footer')">
        <TextField v-bind="key.form.bind('name')" :label="t('core.serviceaccounts.keys.fields.name')" :max-length="100" required :placeholder="t('core.serviceaccounts.keys.fields.name_placeholder')" />
        <DateField v-bind="key.form.bind('expires')" :label="t('core.serviceaccounts.keys.fields.expires')" :hint="t('core.serviceaccounts.keys.fields.expires_hint')" :min="todayOf()" />
      </FormGroup>
    </div>
  </CommandDialog>
</template>
