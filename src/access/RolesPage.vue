<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { IconTile, Tabs } from "../controls";
import { FormGroup, FormRow, TextField } from "../form";
import { AdaptivePageShell } from "../page";
import type { PageAction } from "../page";
import { usePlatform } from "../platform";
import { AsyncSection, Badge } from "../state";
import { useLoad } from "../state";
import type { RoleSummary } from "../modules/access/entities";
import { useAccessApi } from "./api";
import { accessPermissions } from "./context";
import { useAccessLabels } from "./labels";
import { accessPages } from "./routes";

/**
 * Roles: every role, the predefined ones that come with the application and the custom ones, with its kind and how many people
 * hold it. A role is given to a person on their record, together with where; nothing here assigns.
 */
const { t } = useI18n();
const router = useRouter();
const { access } = usePlatform();
const labels = useAccessLabels();
const api = useAccessApi();

const roles = useLoad(({ signal }) => api.roles({ signal }));
const kind = ref<"all" | "predefined" | "custom">("all");
const search = ref("");

const all = computed<readonly RoleSummary[]>(() => roles.data.value ?? []);
const tabs = computed(() => [
  { value: "all" as const, label: t("core.access.kinds.all"), badge: all.value.length },
  { value: "predefined" as const, label: t("core.access.kinds.predefined"), badge: all.value.filter((role) => role.predefined).length },
  { value: "custom" as const, label: t("core.access.kinds.custom"), badge: all.value.filter((role) => !role.predefined).length },
]);

const shown = computed(() => {
  const needle = search.value.trim().toLowerCase();
  return all.value.filter(
    (role) => (kind.value === "all" || (kind.value === "predefined") === role.predefined) && (needle === "" || `${labels.roleName(role)} ${role.description}`.toLowerCase().includes(needle)),
  );
});

const actions = computed<PageAction[]>(() =>
  access.can(accessPermissions.manageRoles)
    ? [{ id: "create", label: t("core.access.create"), icon: "addLine", placement: "primary", compact: "icon", onClick: () => void router.push(accessPages.newRole) }]
    : [],
);
const sub = (role: RoleSummary) => [role.description, t("core.access.permissions", { count: role.permission_count })].filter(Boolean).join(" · ");
</script>

<template>
  <AdaptivePageShell :title="t('core.access.title')" :description="t('core.access.description')" icon="shieldStarFill" :count="all.length || null" :actions="actions">
    <div class="flex min-w-0 flex-col gap-group-gap" data-test="roles-index">
      <div class="flex flex-wrap items-center gap-3">
        <Tabs v-model="kind" :tabs="tabs" presentation="scope" />
        <TextField v-model="search" class="min-w-[14rem] flex-1" :placeholder="t('core.access.search')" />
      </div>

      <AsyncSection :state="roles.state.value" :skeleton-rows="6" :is-empty="() => false" @retry="roles.reload()">
        <FormGroup :footer="t('core.access.list_footer')">
          <p v-if="shown.length === 0" class="px-row-inset py-6 text-center text-body text-content-muted" data-test="roles-empty">{{ t("core.access.empty") }}</p>

          <FormRow v-for="role in shown" :key="role.ref" layout="setting" :label="labels.roleName(role)" :sub="sub(role)" :to="accessPages.role({ ref: role.ref })">
            <template #leading><IconTile :tone="role.predefined ? 'anchor' : 'brand'" icon="shieldStarFill" /></template>
            <Badge :tone="role.predefined ? 'neutral' : 'info'">{{ labels.roleKind(role) }}</Badge>
            <span class="min-w-[4.5rem] text-right text-footnote tabular-nums text-content-muted" data-test="role-holders">{{ t("core.access.holders_count", { count: role.holders }) }}</span>
          </FormRow>
        </FormGroup>
      </AsyncSection>
    </div>
  </AdaptivePageShell>
</template>
