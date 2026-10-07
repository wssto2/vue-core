<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { Modal } from "@wssto2/vue-core/modal";
import { AdaptivePageShell } from "@wssto2/vue-core/page";
import { ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import type { Customer } from "../api";
import CustomerPickList from "../components/CustomerPickList.vue";

const { t } = useI18n();

const dialog = useTemplateRef<InstanceType<typeof Modal>>("dialog");
const chosen = ref<Customer | null>(null);
const name = (customer: Customer) => (customer.type === 2 ? customer.company_name : `${customer.first_name} ${customer.last_name}`);

function onPick(customer: Customer) {
  chosen.value = customer;
  void dialog.value?.dismiss();
}
</script>

<template>
  <AdaptivePageShell :title="t('customers.pick_title')" :description="t('customers.pick_description')">
    <p class="mb-4 text-body text-content-muted">{{ chosen ? t("customers.pick_chosen", { name: name(chosen) }) : t("customers.pick_none") }}</p>
    <Button @click="dialog?.present()">{{ t("customers.pick_open") }}</Button>

    <Modal ref="dialog" :title="t('customers.pick_open')" size="lg" grouped without-footer>
      <CustomerPickList @pick="onPick" />
    </Modal>
  </AdaptivePageShell>
</template>
