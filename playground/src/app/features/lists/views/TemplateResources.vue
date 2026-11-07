<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { FileExplorer, type ExplorerRow, type TableColumns } from "@wssto2/vue-core/collection";
import { Icon } from "@wssto2/vue-core/icon";
import { AdaptivePageShell } from "@wssto2/vue-core/page";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

interface Resource extends ExplorerRow {
  info: string;
  size?: string;
  edited: string;
}

const { t } = useI18n();
const ROWS: Resource[] = [
  { id: 1, kind: "folder", name: "css", info: t("lists.items", 2), edited: "2026-10-12T10:00:00Z" },
  { id: 2, kind: "folder", name: "js", info: t("lists.items", 1), edited: "2026-10-12T10:00:00Z" },
  { id: 3, kind: "folder", name: "slike", info: t("lists.items", 14), edited: "2026-11-03T10:00:00Z" },
  { id: 4, kind: "folder", name: "fontovi", info: t("lists.items", 4), edited: "2026-10-12T10:00:00Z" },
  { id: 5, kind: "file", name: "favicon.png", info: "PNG · 64 × 64", size: "2,1 KB", edited: "2026-10-12T10:00:00Z" },
  { id: 6, kind: "file", name: "logo-lavcevic.svg", info: "SVG", size: "6,4 KB", edited: "2026-10-12T10:00:00Z" },
];
const selected = ref<(string | number)[]>([]);
const folder = ref<string | null>(null);
const columns = computed(() => [
  { key: "info", label: t("lists.info"), width: 280 },
  { key: "size", label: t("lists.size"), width: 120 },
  { key: "edited", label: t("lists.edited"), kind: "timestamp", precision: "date", width: 160, hideBelow: "md" },
] satisfies TableColumns<Resource>);
const rowActions = () => [
  { key: "rename", label: t("lists.rename"), icon: "edit" as const, onSelect: () => undefined },
  { key: "delete", label: t("lists.delete"), icon: "deleteBin2Line" as const, tone: "critical" as const, onSelect: () => undefined },
];
</script>

<template>
  <AdaptivePageShell :title="t('lists.resources_title')" :description="t('lists.resources_description')">
    <FileExplorer v-model:selected="selected" v-model:folder="folder" :rows="ROWS" :columns="columns" :label="t('lists.resources_title')" :row-actions="rowActions"
      :breadcrumb="[{ id: null, label: t('lists.root') }]">
      <template #switch><span class="inline-flex items-center gap-1 text-body text-content-strong">Osnovni predložak<Icon name="arrowDownSLine" :size="16" /></span></template>
      <template #toolbar>
        <Button size="sm" icon="download">{{ t("lists.upload") }}</Button>
        <Button size="sm" icon="folderLine">{{ t("lists.new_directory") }}</Button>
        <Button size="sm" prominence="primary" icon="addLine">{{ t("lists.new") }}</Button>
      </template>
    </FileExplorer>
  </AdaptivePageShell>
</template>
