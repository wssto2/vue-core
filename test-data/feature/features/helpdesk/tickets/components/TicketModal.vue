<script setup lang="ts">
import { TextField, useForm } from "@wssto2/vue-core/form";
import { Modal } from "@wssto2/vue-core/modal";
import { usePlatform } from "@wssto2/vue-core/platform";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { ticketsApi } from "../api";
import { TicketFormSchema } from "../form";

const emit = defineEmits<{ changed: [] }>();
const { t } = useI18n();
const api = ticketsApi(usePlatform().http);

const modal = ref<InstanceType<typeof Modal> | null>(null);
const form = useForm({ defaults: () => ({ name: "" }), validator: TicketFormSchema });

async function save() {
  const result = await form.submit((payload, { idempotencyKey }) => api.create(payload, idempotencyKey));
  if (result.status !== "saved") return;
  void modal.value?.dismiss();
  emit("changed");
}

function show() {
  form.reset();
  modal.value?.present();
}

defineExpose({ show });
</script>

<template>
  <Modal ref="modal" :title="t('helpdesk.tickets.actions.create')" :primary-label="t('general.actions.save')" :status="form.submitting.value ? 'processing' : 'idle'" @primary="save">
    <TextField v-bind="form.bind('name')" :label="t('helpdesk.tickets.table_columns.name')" />
  </Modal>
</template>
