<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { IconTile, Tabs, type TabItem } from "../../../controls";
import { useFormat } from "../../../format";
import { DateField, FormGroup, FormRow } from "../../../form";
import type { ActivityRow, AreaCount } from "../../../modules/identity/entities";
import { identityRoutes } from "../../../modules/identity/routes";
import { usePlatform } from "../../../platform";
import { useRouteResourceContext } from "../../../resource";
import { AsyncSection, Badge, useLoad } from "../../../state";
import { useActorNames } from "../../shared/actors";
import PageBar from "../../shared/PageBar.vue";
import SectionIntro from "../../shared/SectionIntro.vue";
import { useUsersContext } from "../context";
import { PERSON } from "../person";

/**
 * What the person did: the records they made, changed or deleted, newest first, by day. The areas of the application
 * (named by `usersFeature({ activityAreas })`, plus "all", "identity" and "other") filter it as tabs with their counts, a date
 * range narrows it, and a row done while somebody was signed in as the person says so.
 */
const { t, te } = useI18n();
const { http } = usePlatform();
const format = useFormat();
const person = useRouteResourceContext(PERSON);
const { activityAreas } = useUsersContext();
const actors = useActorNames();

const area = ref("all");
const from = ref<string | null>(null);
const to = ref<string | null>(null);
const page = ref(1);

const history = useLoad(
  async ({ signal }) => {
    const id = person.id.value;
    if (id === null) return null;
    const input = { id, page: page.value, per_page: 20, ...(area.value === "all" ? {} : { area: area.value }), ...(from.value ? { from: from.value } : {}), ...(to.value ? { to: to.value } : {}) };
    return (await http.request(identityRoutes.usersActivity, input, { signal })).data;
  },
  { watch: () => person.id.value },
);
// A new filter starts at its first page; rows and tabs stay on screen until the answer arrives.
watch([area, from, to], () => {
  page.value = 1;
  void history.reload();
});
watch(page, () => void history.reload());
watch(() => history.data.value, (data) => actors.load(data?.data.map((row) => row.signed_in_as) ?? []), { immediate: true });

const label = (key: string): string => {
  if (key === "all" || key === "identity" || key === "other") return t(`core.users.activity.areas.${key}`);
  const named = activityAreas[key];
  return named && te(named) ? t(named) : t("core.users.activity.areas.other");
};

// The server counts the areas under the same range; the one being looked at stays even when it is empty there.
const counts = computed(() => (history.data.value?.meta?.views as readonly AreaCount[] | undefined) ?? []);
const tabs = computed<TabItem<string>[]>(() => {
  const listed = counts.value.filter((view) => view.key === "all" || view.key === area.value || view.count > 0).map((view) => ({ value: view.key, label: label(view.key), badge: view.count }));
  return listed.length > 0 ? listed : [{ value: "all", label: label("all") }];
});

const verb = (action: string) => (te(`core.users.activity.actions.${action}`) ? t(`core.users.activity.actions.${action}`) : t("core.users.activity.actions.other"));

// Days, newest first, as the server sent them.
const days = computed(() => {
  const out: { key: string; header: string; rows: ActivityRow[] }[] = [];
  for (const row of history.data.value?.data ?? []) {
    const key = row.created_at.slice(0, 10);
    const last = out[out.length - 1];
    if (last && last.key === key) last.rows.push(row);
    else out.push({ key, header: format.date(row.created_at), rows: [row] });
  }
  return out;
});
</script>

<template>
  <div class="flex min-w-0 flex-col gap-group-gap" data-person-activity>
    <SectionIntro :title="t('core.users.sections.activity')" :description="t('core.users.intro.activity', { name: person.data.value?.name ?? '' })" />

    <div class="flex flex-wrap items-end justify-between gap-3">
      <Tabs v-model="area" :tabs="tabs" presentation="scope" :label="t('core.users.activity.areas_label')" />
      <div class="flex items-end gap-2" data-activity-range>
        <DateField v-model="from" :label="t('core.users.activity.from')" :max="to ?? undefined" />
        <DateField v-model="to" :label="t('core.users.activity.to')" :min="from ?? undefined" />
      </div>
    </div>

    <AsyncSection :state="history.state.value" :skeleton-rows="5" :is-empty="() => false" @retry="history.reload()">
      <template #default="{ value }">
        <p v-if="!value || value.data.length === 0" class="px-row-inset py-4 text-body text-content-muted" data-activity-empty>{{ t("core.users.activity.empty") }}</p>
        <div v-else class="flex min-w-0 flex-col gap-group-gap" data-activity-feed>
          <FormGroup v-for="day in days" :key="day.key" :header="day.header">
            <FormRow v-for="row in day.rows" :key="row.id" layout="setting" :label="`${verb(row.action)}`" data-activity-row>
              <template #leading>
                <IconTile tone="anchor" icon="listCheck" />
              </template>
              <template #sub>
                <span class="flex flex-wrap items-center gap-x-1.5">
                  <span>{{ label(row.area) }}</span>
                  <span aria-hidden="true">·</span>
                  <span>{{ row.record_type }} #{{ row.record_id }}</span>
                </span>
              </template>
              <Badge v-if="row.signed_in_as !== null" tone="warning" data-activity-signed-in-as>
                {{ actors.nameOf(row.signed_in_as) ? t("core.users.activity.signed_in_as", { name: actors.nameOf(row.signed_in_as) }) : t("core.users.activity.signed_in_as_other") }}
              </Badge>
              <span class="text-body tabular-nums text-content-muted">{{ format.time(row.created_at) }}</span>
            </FormRow>
          </FormGroup>
        </div>
        <PageBar v-if="value" v-model:page="page" :last-page="value.last_page" :total="value.total" />
        <p class="px-row-inset text-footnote text-content-muted">{{ t("core.users.activity.footer") }}</p>
      </template>
    </AsyncSection>
  </div>
</template>
