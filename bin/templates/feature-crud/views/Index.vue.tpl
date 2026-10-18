<script setup lang="ts">
import { CollectionPage, useCollection, type CollectionColumns } from "@wssto2/vue-core/collection";
import type { PageAction } from "@wssto2/vue-core/page";
import { usePlatform } from "@wssto2/vue-core/platform";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { MODULE_ICON } from "@/features/__FEATURE_PATH__";
import { __FEATURE_API_CLIENT__, __FEATURE_LIST__, type __FEATURE_ENTITY__Sort } from "../api";
import type { __FEATURE_ENTITY__ } from "../types";
import __FEATURE_ENTITY__Modal from "../components/__FEATURE_ENTITY__Modal.vue";

const { t } = useI18n();
const { access, http } = usePlatform();

const featureModal = ref<InstanceType<typeof __FEATURE_ENTITY__Modal> | null>(null);

// One columns array drives the table and the phone row: `mobile` says what a column is on a phone.
const columns = computed(() => [
  { key: "name", label: t("__FEATURE_I18N_MODULE__.table_columns.name"), kind: "identity", sort: "name", mobile: "primary", subtitle: (item: __FEATURE_ENTITY__) => `ID: ${item.id}` },
  { key: "created_at", label: t("general.table_columns.created_at"), kind: "timestamp", sort: "created_at", width: 150, align: "center", mobile: "hidden" },
  { key: "updated_at", label: t("general.table_columns.updated_at"), kind: "timestamp", sort: "updated_at", width: 150, align: "center", mobile: "hidden" },
] satisfies CollectionColumns<__FEATURE_ENTITY__, __FEATURE_ENTITY__Sort>);

const collection = useCollection(__FEATURE_LIST__(__FEATURE_API_CLIENT__(http)), { columns, state: { kind: "memory" } });

const actions = computed<PageAction[]>(() => (access.can("__FEATURE_I18N_MODULE__:manage") ? [{
  id: "create", label: t("__FEATURE_I18N_MODULE__.actions.create"), icon: "addLine", placement: "primary", compact: "icon",
  keyboardShortcut: { key: "N", ctrlKey: true }, onClick: () => featureModal.value?.show(),
}] : []));
</script>

<template>
  <CollectionPage :collection="collection" :title="t('__FEATURE_I18N_MODULE__.title')" :description="t('__FEATURE_I18N_MODULE__.description')" :icon="MODULE_ICON" :actions="actions">
    <__FEATURE_ENTITY__Modal ref="featureModal" @changed="collection.refresh()" />
  </CollectionPage>
</template>
