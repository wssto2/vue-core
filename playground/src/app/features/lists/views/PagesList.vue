<script setup lang="ts">
import { FileExplorer, type ExplorerRow, type TableColumns } from "@wssto2/vue-core/collection";
import { Button } from "@wssto2/vue-core/button";
import { Icon } from "@wssto2/vue-core/icon";
import { AdaptivePageShell, type PageAction } from "@wssto2/vue-core/page";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";

interface Entry extends ExplorerRow {
  url?: string;
  active?: boolean;
  inMenu?: boolean;
  template?: string;
  edited: string;
}

const { t } = useI18n();
const route = useRoute();
const ROWS: Entry[] = [
  { id: 1, kind: "folder", name: "Usluge", edited: "2026-11-05T09:00:00Z" },
  { id: 2, kind: "folder", name: "O nama", edited: "2026-10-30T09:00:00Z" },
  { id: 3, kind: "page", name: "Naslovnica", url: "/", active: true, inMenu: true, template: "Predložak naslovnice", edited: "2026-11-07T09:41:00Z" },
  { id: 4, kind: "page", name: "Kontakt", url: "/kontakt", active: true, inMenu: true, template: "Osnovni predložak", edited: "2026-11-02T10:00:00Z" },
  { id: 5, kind: "page", name: "Reference", url: "/reference", active: true, inMenu: true, template: "Predložak referenci", edited: "2026-11-02T10:00:00Z" },
  { id: 6, kind: "page", name: "Reference: detalji", url: "/reference/details", active: true, inMenu: false, template: "Detaljna stranica", edited: "2026-11-02T10:00:00Z" },
  { id: 7, kind: "page", name: "Stari katalog", url: "/katalog", active: false, inMenu: false, template: "Osnovni predložak", edited: "2026-09-12T10:00:00Z" },
  { id: 8, kind: "link", name: "Webshop", url: "https://webshop.lavcevic.example", inMenu: true, template: t("lists.link_target"), edited: "2026-10-01T10:00:00Z" },
];

// `?selected` starts with two rows ticked, to see the selection bar.
const selected = ref<(string | number)[]>(route.query.selected !== undefined ? [4, 5] : []);
const folder = ref<string | null>(null);
const columns = computed(() => [
  { key: "url", label: t("lists.url"), width: 240 },
  { key: "active", label: t("lists.active"), width: 100 },
  { key: "inMenu", label: t("lists.in_menu"), width: 110 },
  { key: "template", label: t("lists.template"), width: 220, hideBelow: "xl" },
  { key: "edited", label: t("lists.edited"), kind: "timestamp", precision: "date", width: 160, hideBelow: "md" },
] satisfies TableColumns<Entry>);

const batch = (rows: readonly Entry[]): PageAction[] => [
  { id: "download", label: t("lists.download"), icon: "download", onClick: () => undefined },
  { id: "copy", label: t("lists.copy"), icon: "copy", onClick: () => undefined },
  { id: "move", label: t("lists.move"), icon: "arrowRightSLine", onClick: () => undefined },
  { id: "push", label: t("lists.push"), icon: "externalLink", disabled: rows.some((row) => row.kind === "folder"), onClick: () => undefined },
  { id: "delete", label: t("lists.delete"), icon: "deleteBin2Line", tone: "critical", onClick: () => undefined },
];
const rowActions = (row: Entry) => [
  { key: "rename", label: t("lists.rename"), icon: "edit" as const, onSelect: () => undefined },
  { key: "delete", label: t("lists.delete"), icon: "deleteBin2Line" as const, tone: "critical" as const, onSelect: () => undefined },
  ...(row.kind === "page" ? [{ key: "copy", label: t("lists.copy"), icon: "copy" as const, onSelect: () => undefined }] : []),
];
</script>

<template>
  <AdaptivePageShell :title="t('lists.pages_title')" :description="t('lists.pages_description', { host: 'lavcevic.example' })">
    <FileExplorer v-model:selected="selected" v-model:folder="folder" :rows="ROWS" :columns="columns" :label="t('lists.all_pages')" :selection-actions="batch" :row-actions="rowActions">
      <template #switch>
        <button type="button" class="inline-flex cursor-pointer items-center gap-1 rounded-md px-1 py-1 text-body text-content-strong hover:bg-fill">lavcevic.example<Icon name="arrowDownSLine" :size="16" /></button>
      </template>
      <template #toolbar>
        <Button size="sm" icon="download">{{ t("lists.upload") }}</Button>
        <Button size="sm" icon="folderLine">{{ t("lists.new_directory") }}</Button>
        <Button size="sm" prominence="primary" icon="addLine">{{ t("lists.new") }}</Button>
      </template>
      <template #cell-url="{ value }"><code class="font-mono text-footnote text-content-muted">{{ value }}</code></template>
      <template #cell-active="{ item }"><Icon v-if="item.active" name="checkCustom" :size="16" class="text-status-positive-content" /><span v-else-if="item.kind === 'page'" class="text-content-disabled">—</span></template>
      <template #cell-inMenu="{ item }"><Icon v-if="item.inMenu" name="checkCustom" :size="16" class="text-status-positive-content" /><span v-else-if="item.kind !== 'folder'" class="text-content-disabled">—</span></template>
    </FileExplorer>
  </AdaptivePageShell>
</template>
