<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { ChangeView } from "../../../modules/identity/entities";
import { identityRoutes } from "../../../modules/identity/routes";
import { usePlatform } from "../../../platform";
import { useRouteResourceContext } from "../../../resource";
import { AsyncSection, useLoad } from "../../../state";
import ChangeFeed from "../../shared/ChangeFeed.vue";
import PageBar from "../../shared/PageBar.vue";
import SectionIntro from "../../shared/SectionIntro.vue";
import ViewTabs from "../../shared/ViewTabs.vue";
import { PERSON } from "../person";

/** What was changed on the person's account and who did it: their details, a password, an address, activation, newest first. */
const CHANGE_VIEWS = ["all", "access", "details"] as const satisfies readonly ChangeView[];
const { t } = useI18n();
const { http } = usePlatform();
const person = useRouteResourceContext(PERSON);
const view = ref<ChangeView>("all");
const page = ref(1);

const history = useLoad(
  async ({ signal }) => {
    const id = person.id.value;
    return id === null ? null : (await http.request(identityRoutes.usersChanges, { id, view: view.value, page: page.value, per_page: 20 }, { signal })).data;
  },
  { watch: () => person.id.value },
);
// A new view starts at its first page; a new page or view replaces the rows when it arrives: the feed and the pager stay on screen meanwhile.
watch(view, () => {
  page.value = 1;
  void history.reload();
});
watch(page, () => void history.reload());
</script>

<template>
  <div class="flex min-w-0 flex-col gap-group-gap" data-person-changes>
    <SectionIntro :title="t('core.users.sections.changes')" :description="t('core.users.intro.changes', { name: person.data.value?.name ?? '' })" />
    <ViewTabs v-model="view" :views="CHANGE_VIEWS" :counts="history.data.value?.meta?.views" :label-of="(key) => t(`core.users.changes.views.${key}`)" :label="t('core.users.sections.changes')" />

    <AsyncSection :state="history.state.value" :skeleton-rows="5" :is-empty="() => false" @retry="history.reload()">
      <template #default="{ value }">
        <p v-if="!value || value.data.length === 0" class="px-row-inset py-4 text-body text-content-muted" data-changes-empty>{{ t("core.users.changes.empty") }}</p>
        <ChangeFeed v-else :rows="value.data" />
        <PageBar v-if="value" v-model:page="page" :last-page="value.last_page" :total="value.total" />
      </template>
    </AsyncSection>
  </div>
</template>
