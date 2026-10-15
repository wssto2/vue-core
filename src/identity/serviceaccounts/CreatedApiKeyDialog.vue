<script setup lang="ts">
import { ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "../../button";
import { FormGroup, FormRow } from "../../form";
import { useFormat } from "../../format";
import { copyText } from "../../internal/copyText";
import { Modal } from "../../modal";
import type { CreatedApiKey, ServiceAccount } from "../../modules/serviceaccount/entities";
import { toast } from "../../overlay";
import { Banner } from "../../state";

/**
 * *The API key is created*: the secret, shown once, with *Copy* and the plain fact that it will not be shown again. It lives only in
 * this sheet's state and is dropped when the sheet closes; only the primary button closes it, so a stray tap outside does not lose
 * what nothing can bring back.
 */
const props = defineProps<{ account: ServiceAccount }>();
const emit = defineEmits<{ done: [] }>();

const { t } = useI18n();
const format = useFormat();
const dialog = useTemplateRef<InstanceType<typeof Modal>>("dialog");

const created = ref<CreatedApiKey | null>(null);
const acknowledged = ref(false);

function show(next: CreatedApiKey) {
  created.value = next;
  acknowledged.value = false;
  dialog.value?.present();
}

async function copySecret() {
  if (created.value && (await copyText(created.value.secret))) toast.success(t("core.serviceaccounts.keys.copied"));
}

function done() {
  acknowledged.value = true;
  dialog.value?.dismiss();
  created.value = null;
  emit("done");
}

// Leaving any other way keeps the sheet: the key cannot be shown again.
const beforeClose = () => acknowledged.value;

defineExpose({ show, done, copySecret, created });
</script>

<template>
  <Modal ref="dialog" :title="t('core.serviceaccounts.keys.created_title')" :subtitle="props.account.name" size="md" grouped :before-dismiss="beforeClose" without-close-button
    :primary-label="t('core.serviceaccounts.keys.saved_it')" @primary="done">
    <div v-if="created" class="flex min-w-0 flex-col gap-group-gap" data-test="created-api-key">
      <FormGroup>
        <FormRow layout="stacked">
          <div class="flex min-w-0 items-center gap-3">
            <code class="min-w-0 flex-1 break-all rounded-control bg-fill px-3 py-2 font-mono text-body text-content-strong select-all" data-test="api-key-secret">{{ created.secret }}</code>
            <span class="contents" data-test="copy-api-key">
              <Button prominence="secondary" icon="copy" @click="copySecret">{{ t("core.serviceaccounts.keys.copy") }}</Button>
            </span>
          </div>
        </FormRow>
      </FormGroup>

      <div data-test="api-key-once"><Banner tone="warning" icon="alertTriangle">{{ t("core.serviceaccounts.keys.once") }}</Banner></div>

      <FormGroup>
        <FormRow layout="setting" :label="t('core.serviceaccounts.keys.fields.name')" :value="created.key.name" />
        <FormRow layout="setting" :label="t('core.serviceaccounts.title')" :value="props.account.name" />
        <FormRow layout="setting" :label="t('core.serviceaccounts.keys.fields.expires')" :value="created.key.expires_at ? format.date(created.key.expires_at) : t('core.serviceaccounts.keys.no_expiry')" />
      </FormGroup>
    </div>
  </Modal>
</template>
