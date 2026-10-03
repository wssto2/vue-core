<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Panel } from "../../content";
import type { SignInView } from "../../modules/identity/entities";
import { identityRoutes } from "../../modules/identity/routes";
import { usePlatform } from "../../platform";
import { AsyncSection, useLoad } from "../../state";
import PageBar from "../shared/PageBar.vue";
import SignInTable from "../shared/SignInTable.vue";
import ViewTabs from "../shared/ViewTabs.vue";

/**
 * Every sign-in to the person's own account, successful and refused, so a stranger's failed attempts, or a sign-in they do
 * not know, can be seen.
 */
const { t } = useI18n();
const { http } = usePlatform();
const SIGNIN_VIEWS = ["all", "failed"] as const satisfies readonly SignInView[];
const view = ref<SignInView>("all");
const page = ref(1);

const history = useLoad(async ({ signal }) => (await http.request(identityRoutes.profileSignins, { view: view.value, page: page.value, per_page: 20 }, { signal })).data);
// A new view starts at its first page; a new page or view replaces the rows when it arrives: the table and the pager stay on screen meanwhile.
watch(view, () => {
  page.value = 1;
  void history.reload();
});
watch(page, () => void history.reload());
</script>

<template>
  <Panel :title="t('core.profile.signins.title')" icon="timeFill" flush data-profile-signins>
    <div class="px-3 pt-3"><ViewTabs v-model="view" :views="SIGNIN_VIEWS" :counts="history.data.value?.meta?.views" :label-of="(key) => t(`core.account.signins.views.${key}`)" :label="t('core.profile.signins.title')" /></div>
    <AsyncSection :state="history.state.value" :skeleton-rows="4" :is-empty="() => false" @retry="history.reload()">
      <template #default="{ value }">
        <div class="px-3 pt-3"><SignInTable :rows="value.data" /></div>
        <div class="py-3"><PageBar v-model:page="page" :last-page="value.last_page" :total="value.total" /></div>
        <p class="px-4 pb-3 text-footnote text-content-muted">{{ t("core.profile.signins.footer") }}</p>
      </template>
    </AsyncSection>
  </Panel>
</template>
