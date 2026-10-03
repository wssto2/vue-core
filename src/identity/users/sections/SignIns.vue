<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { SignInView } from "../../../modules/identity/entities";
import { identityRoutes } from "../../../modules/identity/routes";
import { usePlatform } from "../../../platform";
import { useRouteResourceContext } from "../../../resource";
import { AsyncSection, useLoad } from "../../../state";
import PageBar from "../../shared/PageBar.vue";
import SectionIntro from "../../shared/SectionIntro.vue";
import SignInTable from "../../shared/SignInTable.vue";
import ViewTabs from "../../shared/ViewTabs.vue";
import { PERSON } from "../person";

/**
 * Every sign-in to the person's account, successful and refused, with when, from which device and address, and who did it
 * when somebody else did (signing in as them, unlocking, ending sessions), newest first.
 */
const SIGNIN_VIEWS = ["all", "failed"] as const satisfies readonly SignInView[];
const { t } = useI18n();
const { http } = usePlatform();
const person = useRouteResourceContext(PERSON);
const view = ref<SignInView>("all");
const page = ref(1);

const history = useLoad(
  async ({ signal }) => {
    const id = person.id.value;
    return id === null ? null : (await http.request(identityRoutes.usersSignins, { id, view: view.value, page: page.value, per_page: 20 }, { signal })).data;
  },
  { watch: () => person.id.value },
);
// A new view starts at its first page; a new page or view replaces the rows when it arrives: the table and the pager stay on screen meanwhile.
watch(view, () => {
  page.value = 1;
  void history.reload();
});
watch(page, () => void history.reload());
</script>

<template>
  <div class="flex min-w-0 flex-col gap-group-gap" data-person-signins>
    <SectionIntro :title="t('core.users.sections.signins')" :description="t('core.users.intro.signins', { name: person.data.value?.name ?? '' })" />
    <ViewTabs v-model="view" :views="SIGNIN_VIEWS" :counts="history.data.value?.meta?.views" :label-of="(key) => t(`core.account.signins.views.${key}`)" :label="t('core.users.sections.signins')" />

    <AsyncSection :state="history.state.value" :skeleton-rows="5" :is-empty="() => false" @retry="history.reload()">
      <template #default="{ value }">
        <SignInTable :rows="value?.data ?? []" />
        <PageBar v-if="value" v-model:page="page" :last-page="value.last_page" :total="value.total" />
        <p class="px-row-inset text-footnote text-content-muted">{{ t("core.account.signins.footer_user") }}</p>
      </template>
    </AsyncSection>
  </div>
</template>
