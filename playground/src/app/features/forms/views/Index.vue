<script setup lang="ts">
import { FormGroup, FormRow } from "@wssto2/vue-core/form";
import { AdaptivePageShell, type PageAction } from "@wssto2/vue-core/page";
import { AsyncSection, type AsyncState } from "@wssto2/vue-core/state";
import { computed, onMounted, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { api, type Account } from "../api";
import { formsRoutes } from "../routes";

const { t } = useI18n();
const router = useRouter();
const state = shallowRef<AsyncState<Account[]>>({ status: "loading" });

function load() {
  state.value = { status: "loading" };
  api.accounts().then(
    (value) => (state.value = { status: "loaded", value }),
    () => (state.value = { status: "failed", error: t("forms.loadFailed") }),
  );
}
onMounted(load);

const actions = computed<PageAction[]>(() => [{ id: "new-offer", label: t("forms.newOffer"), placement: "primary", icon: "save", onClick: () => void router.push(formsRoutes.newOffer) }]);
</script>

<template>
  <AdaptivePageShell :title="t('forms.title')" :description="t('forms.intro')" :actions="actions" width="content">
    <AsyncSection :state="state" :is-empty="(accounts: Account[]) => accounts.length === 0" @retry="load">
      <template #default="{ value }">
        <FormGroup :header="t('forms.accounts')" :footer="t('forms.accountsHint')">
          <FormRow v-for="account in value" :key="account.id" :label="account.name" :sub="`${account.city} · ${t(`forms.status.${account.status}`)}`" :to="formsRoutes.account({ accountID: account.id })" layout="setting" />
        </FormGroup>
        <FormGroup :header="t('forms.dates.title')">
          <FormRow :label="t('forms.dates.link')" :sub="t('forms.dates.intro')" :to="formsRoutes.dates" layout="setting" />
          <FormRow :label="t('forms.options.link')" :sub="t('forms.options.intro')" :to="formsRoutes.options" layout="setting" />
        </FormGroup>
      </template>
    </AsyncSection>
  </AdaptivePageShell>
</template>
