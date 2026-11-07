<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { CollectionTree, type TreeReorder } from "../collection";
import { Tabs, type TabItem } from "../controls";
import { TextField } from "../form";
import { useDescribeError } from "../i18n/describeError";
import type { DescriptionResponse, ItemResponse } from "../modules/characteristics/entities";
import { toast } from "../overlay";
import { AdaptivePageShell, type PageAction } from "../page";
import { useAccess } from "../platform";
import { AsyncSection, Badge, useLoad } from "../state";
import { EDIT_CHARACTERISTICS } from "./access";
import { useCharacteristicsApi } from "./api";
import { useCharacteristicsContext } from "./context";
import DeleteDialog from "./DeleteDialog.vue";
import ItemSheet from "./ItemSheet.vue";
import { buildTree, displayValue, keyOf, listColumns, parseKey, type CharacteristicNode } from "./model";

/**
 * Characteristics: go-core's lookup lists as one tree (brands, categories, countries; as many levels as the project described), the screen
 * for whoever may see them (`characteristics:view`) and, for whoever may edit (`characteristics:edit`), their actions. Everything about the
 * project comes from `GET /v1/characteristics/description`: the levels and their names, the languages, the extra fields (in the list or not,
 * read-only or not, for one branch or all), so two projects with different tables get different screens from the same code.
 *
 * Rows open in a sheet; the switch activates and deactivates; the handle (or Alt+↑ / Alt+↓) reorders among siblings (`PUT .../position`);
 * each level has its add button, labelled with the level's name; Delete asks where the item is used first.
 */
const { t, locale } = useI18n();
const access = useAccess();
const api = useCharacteristicsApi();
const context = useCharacteristicsContext();
const describeError = useDescribeError();
const canEdit = computed(() => access.can(EDIT_CHARACTERISTICS));

interface Loaded {
  description: DescriptionResponse;
  items: readonly ItemResponse[];
}
const load = useLoad<Loaded>(async ({ signal }) => {
  const [description, items] = await Promise.all([api.description({ signal }), api.tree({ signal })]);
  return { description, items };
});

const view = ref<"all" | "active" | "inactive">("all");
const search = ref("");
const expanded = ref<(string | number)[]>([]);
const sheet = useTemplateRef<InstanceType<typeof ItemSheet>>("sheet");
const removal = useTemplateRef<InstanceType<typeof DeleteDialog>>("removal");

const items = computed(() => load.data.value?.items ?? []);
const description = computed(() => load.data.value?.description ?? null);
const nodes = computed(() => (description.value ? buildTree(items.value, description.value) : []));
const columns = computed(() => (description.value ? listColumns(description.value, locale.value) : []));
const levelOf = (level: number) => description.value?.levels.find((each) => each.level === level);
const hasActive = computed(() => description.value?.levels.some((level) => level.has_active) ?? false);
const reorderable = computed(() => canEdit.value && (description.value?.levels.some((level) => level.has_order) ?? false));

// What a change did to the list, at once: the server confirms, a failure puts it back by reading the list again.
const patch = (change: (list: readonly ItemResponse[]) => readonly ItemResponse[]) => description.value && load.update({ description: description.value, items: change(items.value) });
const replaceItem = (item: ItemResponse) => patch((list) => (list.some((each) => each.level === item.level && each.id === item.id) ? list.map((each) => (each.level === item.level && each.id === item.id ? item : each)) : [...list, item]));
const failed = (error: unknown) => {
  toast.error(describeError(error, { fallback: t("core.resource.unavailable") }));
  void load.reload();
};

const tabs = computed<TabItem[]>(() => [
  { value: "all", label: t("core.characteristics.views.all") },
  { value: "active", label: t("core.characteristics.views.active") },
  { value: "inactive", label: t("core.characteristics.views.inactive") },
]);
const filter = computed(() => (view.value === "all" ? undefined : (node: CharacteristicNode) => (node.active ?? true) === (view.value === "active")));

async function toggle(node: CharacteristicNode, active: boolean) {
  const before = node.item;
  void replaceItem({ ...before, active });
  try {
    replaceItem(await api.setActive(before.level, before.id, active));
    toast.success(t(active ? "core.characteristics.toasts.activated" : "core.characteristics.toasts.deactivated"));
  } catch (error) {
    failed(error);
  }
}

async function reorder({ id, parentId, index }: TreeReorder) {
  const moved = parseKey(id);
  const parent = parentId === null ? null : parseKey(parentId);
  const siblings = items.value.filter((item) => item.level === moved.level && (parent === null || item.parent_id === parent.id)).sort((a, b) => a.order - b.order || a.id - b.id);
  const from = siblings.findIndex((item) => item.id === moved.id);
  if (from < 0) return;
  const next = [...siblings];
  next.splice(index, 0, ...next.splice(from, 1));
  const order = new Map(next.map((item, position) => [keyOf(item.level, item.id), position + 1]));
  void patch((list) => list.map((item) => (order.has(keyOf(item.level, item.id)) ? { ...item, order: order.get(keyOf(item.level, item.id)) ?? item.order } : item)));
  try {
    await api.move(moved.level, moved.id, index + 1);
  } catch (error) {
    failed(error);
  }
}

function onSaved(item: ItemResponse, created: boolean) {
  replaceItem(item);
  if (created && item.level > 1) expanded.value = [...new Set([...expanded.value, keyOf(item.level - 1, item.parent_id)])];
}
function onDeleted(node: CharacteristicNode) {
  // The branch below goes with it (the server deleted it deepest first).
  const gone = new Set<string>();
  const mark = (each: CharacteristicNode) => {
    gone.add(each.id as string);
    each.children?.forEach(mark);
  };
  mark(node);
  patch((list) => list.filter((item) => !gone.has(keyOf(item.level, item.id))));
}

// A whole phrase per level, never a noun pasted after a verb: the library's neutral one by role (group at the top, item below), or the application's own.
const phrase = (parent: CharacteristicNode | null, level: number): string => {
  const own = context.addLabel?.(parent ? { level: parent.level, name: parent.item.name } : null, level);
  return own ?? t(level === 1 ? "core.characteristics.add_group" : "core.characteristics.add_item");
};
const addLabel = (parent: CharacteristicNode | null, level: number) => (canEdit.value && levelOf(level) ? phrase(parent, level) : null);
const rowActions = (node: CharacteristicNode) =>
  canEdit.value
    ? [
        { key: "edit", label: t("core.characteristics.edit"), icon: "edit" as const, onSelect: () => sheet.value?.edit(node) },
        ...(levelOf(node.level)?.has_active ? [{ key: "active", label: t(node.item.active ? "core.characteristics.deactivate" : "core.characteristics.activate"), icon: node.item.active ? ("eyeOff" as const) : ("eye" as const), onSelect: () => void toggle(node, !node.item.active) }] : []),
        { key: "delete", label: t("core.characteristics.delete"), icon: "deleteBin2Line" as const, tone: "critical" as const, onSelect: () => removal.value?.show(node) },
      ]
    : [{ key: "open", label: t("core.actions.open"), icon: "eye" as const, onSelect: () => sheet.value?.edit(node) }];

const actions = computed<PageAction[]>(() => {
  return canEdit.value && levelOf(1) ? [{ id: "add", label: phrase(null, 1), icon: "addLine", placement: "primary", onClick: () => sheet.value?.create(null) }] : [];
});
</script>

<template>
  <AdaptivePageShell :title="t('core.characteristics.title')" :description="t('core.characteristics.description')" :actions="actions">
    <div class="flex min-w-0 flex-col gap-group-gap" data-test="characteristics">
      <AsyncSection :state="load.state.value" :skeleton-rows="5" :is-empty="(value) => value.items.length === 0" :empty-title="t('core.characteristics.empty')" @retry="load.reload()">
        <template #default="{ value }">
          <div class="flex flex-wrap items-center gap-3">
            <TextField v-model="search" class="min-w-[14rem] max-w-md flex-1" :label="t('core.characteristics.search')" label-hidden :placeholder="t('core.characteristics.search')" />
            <Tabs v-model="view" :tabs="tabs" presentation="scope" :label="t('core.characteristics.title')" />
            <Badge v-if="!canEdit" tone="neutral" class="ml-auto" data-test="characteristics-read-only">{{ t("core.characteristics.read_only") }}</Badge>
          </div>
          <CollectionTree v-model:expanded="expanded" :nodes="nodes" :columns="columns.map((each) => each.column)" :label="t('core.characteristics.title')" :reorderable="reorderable" :readonly="!canEdit"
            :active-label="hasActive ? t('core.characteristics.active') : undefined" :search="search" :filter="filter" :add-label="addLabel" :row-actions="rowActions"
            @reorder="reorder" @toggle="toggle" @add="(parent) => sheet?.create(parent)" @open="(node) => sheet?.edit(node)">
            <template v-for="entry in columns" :key="entry.column.key" #[`cell-${entry.column.key}`]="{ node }">
              <code class="truncate font-mono text-footnote text-content-muted">{{ entry.fields.map(({ field }) => displayValue(field, node.item.values?.[field.column], locale, t("core.form.yes"), t("core.form.no"))).find((text) => text !== "") ?? "" }}</code>
            </template>
          </CollectionTree>
          <p class="px-1 text-footnote text-content-muted" data-test="characteristics-footer">
            {{ t("core.characteristics.levels", value.description.levels.length) }}<template v-if="reorderable"> · {{ t("core.characteristics.reorder_hint") }}</template>
          </p>
        </template>
      </AsyncSection>
    </div>

    <ItemSheet v-if="description" ref="sheet" :description="description" :editable="canEdit" :create-title="phrase" @saved="onSaved" @remove="(node) => removal?.show(node)" />
    <DeleteDialog v-if="canEdit && description" ref="removal" :can-deactivate="(node) => levelOf(node.level)?.has_active ?? false" @deleted="onDeleted" @deactivate="(node) => toggle(node, false)" />
  </AdaptivePageShell>
</template>
