<script setup lang="ts">
import { EditorPage } from "@wssto2/vue-core/form";
import { SectionPanel } from "@wssto2/vue-core/page";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import CreateFields from "../components/CreateFields.vue";
import { useTicketFormsApi } from "../context";
import { useCreateTicketForm } from "../form";

const { t } = useI18n();
const router = useRouter();
const api = useTicketFormsApi();
const form = useCreateTicketForm(t);

async function save() {
  const result = await form.submit((payload, { idempotencyKey }) => api.create({ subject: payload.subject, priority: payload.priority, due_on: null, email: "", phone: "" }, idempotencyKey));
  if (result.status === "saved") void router.push({ name: "forms.record", params: { ticketID: result.value.id } });
}
</script>

<template>
  <EditorPage :title="t('forms.create')" :back="{ label: t('forms.tickets'), to: '/' }" :form="form" :save-label="t('forms.create')" @save="save">
    <SectionPanel :title="t('forms.details')" number="01" presentation="section"><CreateFields :form="form" /></SectionPanel>
  </EditorPage>
</template>
