<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Panel } from "../../content";
import { identityRoutes } from "../../modules/identity/routes";
import { usePlatform } from "../../platform";
import { AsyncSection, useLoad } from "../../state";
import PageBar from "../shared/PageBar.vue";
import SignInTable from "../shared/SignInTable.vue";

/**
 * Every sign-in to the person's own account, successful and refused, so a stranger's failed attempts, or a sign-in they do
 * not know, can be seen.
 */
const { t } = useI18n();
const { http } = usePlatform();
const page = ref(1);

const history = useLoad(async ({ signal }) => (await http.request(identityRoutes.profileSignins, { page: page.value, per_page: 20 }, { signal })).data);
// A new page replaces the rows when it arrives: the table and the pager stay on screen meanwhile.
watch(page, () => void history.reload());
</script>

<template>
  <Panel :title="t('core.profile.signins.title')" icon="timeFill" flush data-profile-signins>
    <AsyncSection :state="history.state.value" :skeleton-rows="4" :is-empty="() => false" @retry="history.reload()">
      <template #default="{ value }">
        <!-- Who signed in as the person (or unlocked them) is somebody else, whom this person may not be able to look up: no name. -->
        <SignInTable :rows="value.data" :actor-name="() => null" />
        <div class="py-3"><PageBar v-model:page="page" :last-page="value.last_page" :total="value.total" /></div>
        <p class="px-4 pb-3 text-footnote text-content-muted">{{ t("core.profile.signins.footer") }}</p>
      </template>
    </AsyncSection>
  </Panel>
</template>
