<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "../button";
import { Tabs } from "../controls";
import { FormGroup, SegmentedField, SwitchField } from "../form";
import { Badge } from "../state";
import type { AccessQualifier } from "../platform";
import { grant, groupOf, ownableQualifier, permissionTree, revoke, setOwnableQualifier, type Grants, type PermissionEntry, type PermissionScreen } from "./catalogue";
import { useAccessContext } from "./context";
import { useAccessLabels } from "./labels";

/**
 * The permissions of a role as the editor shows them: the catalogue's modules (a list on the left, a tab bar on phones)
 * with what the role holds of each, then each screen as a group of switches. Switching a permission on switches on what it
 * needs, off what needs it; where a screen's records have an owner the group opens with *whose* (own, location's, all), held
 * once per record type. `grants` is edited in place; `readonly` shows the role without letting it change.
 */
const props = defineProps<{ grants: Grants; readonly: boolean }>();

const { t } = useI18n();
const { catalogue } = useAccessContext();
const labels = useAccessLabels();

const tree = computed(() => permissionTree(catalogue));
const active = ref<string>(tree.value[0]?.key ?? "");
const current = computed(() => tree.value.find((group) => group.key === active.value) ?? tree.value[0]);

const entriesOf = (key: string) => Object.entries(catalogue).filter(([, meta]) => groupOf(meta) === key).map(([id]) => id);
const totals = (key: string) => {
  const ids = entriesOf(key);
  return { granted: ids.filter((id) => id in props.grants).length, total: ids.length };
};
const countText = (key: string) => `${totals(key).granted} / ${totals(key).total}`;
const tabs = computed(() => tree.value.map((group) => ({ value: group.key, label: labels.groupLabel(group.key), badge: countText(group.key) })));
const allOn = computed(() => current.value !== undefined && totals(current.value.key).granted === totals(current.value.key).total);

function toggleAll() {
  if (!current.value) return;
  for (const id of entriesOf(current.value.key)) {
    if (allOn.value) revoke(catalogue, props.grants, id);
    else grant(catalogue, props.grants, id);
  }
}

const ownablesOf = (screen: PermissionScreen) => [...new Set(screen.permissions.map((entry) => entry.ownable).filter((ownable): ownable is string => ownable !== null))];
const whoseOptions = computed(() => (["own", "own_location", "all"] as const).map((value) => ({ value, label: labels.qualifierLabel(value) })));

function whoseHint(screen: PermissionScreen, ownable: string): string {
  const qualifier = ownableQualifier(catalogue, props.grants, ownable) ?? "own";
  const unowned = screen.permissions.some((entry) => entry.ownable === ownable && entry.unownedIsOwn);
  return [labels.qualifierHint(qualifier), qualifier === "own" && unowned ? t("core.access.unowned") : ""].filter(Boolean).join(" · ");
}

function hintOf(entry: PermissionEntry): string {
  const needs = entry.requires.map((id) => labels.permissionLabel(id)).join(", ");
  return [labels.permissionDescription(entry.id), needs ? t("core.access.requires", { names: needs }) : ""].filter(Boolean).join(" ");
}

const setWhose = (ownable: string, value: AccessQualifier) => setOwnableQualifier(catalogue, props.grants, ownable, value);
const setGranted = (id: string, on: boolean) => (on ? grant(catalogue, props.grants, id) : revoke(catalogue, props.grants, id));
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-8" data-test="permission-tree">
    <!-- Modules: a list on wide screens, the scope bar on phones -->
    <nav class="hidden flex-col gap-0.5 lg:sticky lg:top-4 lg:flex" :aria-label="t('core.access.modules')" data-test="tree-modules">
      <button v-for="group in tree" :key="group.key" type="button" :data-test="`tree-module-${group.key}`"
        :aria-current="active === group.key ? 'true' : undefined"
        class="flex h-9 items-center justify-between gap-3 rounded-control px-3 text-left text-body transition-colors duration-motion-fast hover:bg-fill focus-visible:outline-2 focus-visible:outline-border-focus"
        :class="active === group.key ? 'bg-tint-soft font-semibold text-content-strong' : 'text-content'" @click="active = group.key">
        <span class="min-w-0 flex-1 truncate">{{ labels.groupLabel(group.key) }}</span>
        <span class="text-footnote tabular-nums text-content-muted" :data-test="`tree-count-${group.key}`">{{ countText(group.key) }}</span>
      </button>
    </nav>
    <Tabs v-model="active" :tabs="tabs" presentation="scope" class="lg:hidden" />

    <div v-if="current" class="flex min-w-0 flex-col gap-6" :data-test="`tree-panel-${current.key}`">
      <div class="flex min-w-0 items-center justify-between gap-3 px-row-inset">
        <h2 class="min-w-0 flex-1 text-title3 font-semibold text-content-strong">{{ labels.groupLabel(current.key) }}</h2>
        <span class="text-footnote tabular-nums text-content-muted">{{ countText(current.key) }}</span>
        <span v-if="!props.readonly" class="contents" data-test="tree-toggle-all">
          <Button prominence="secondary" size="sm" @click="toggleAll">{{ allOn ? t("core.access.turn_off_all") : t("core.access.turn_on_all") }}</Button>
        </span>
      </div>

      <FormGroup v-for="screen in current.screens" :key="screen.key" :header="labels.screenLabel(screen.key)">
        <!-- Whose records: only where the catalogue says the permission has an owner -->
        <SegmentedField v-for="ownable in ownablesOf(screen)" :key="ownable" :label="labels.ownableLabel(ownable)" :hint="whoseHint(screen, ownable)"
          :model-value="ownableQualifier(catalogue, props.grants, ownable) ?? 'own'" :options="whoseOptions"
          :disabled="props.readonly || ownableQualifier(catalogue, props.grants, ownable) === null" @update:model-value="setWhose(ownable, $event)" />

        <SwitchField v-for="entry in screen.permissions" :key="entry.id" :label="labels.permissionLabel(entry.id)" :hint="hintOf(entry)"
          :model-value="entry.id in props.grants" :disabled="props.readonly" @update:model-value="setGranted(entry.id, Boolean($event))">
          <template v-if="entry.sensitive || entry.system || entry.organizationOnly" #before>
            <Badge v-if="entry.sensitive" tone="warning">{{ t("core.access.sensitive") }}</Badge>
            <Badge v-if="entry.system" tone="neutral">{{ t("core.access.system") }}</Badge>
            <Badge v-else-if="entry.organizationOnly" tone="info">{{ t("core.access.organization_only") }}</Badge>
          </template>
        </SwitchField>
      </FormGroup>
    </div>
  </div>
</template>
