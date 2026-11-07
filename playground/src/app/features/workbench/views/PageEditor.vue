<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { Tabs, SortableList } from "@wssto2/vue-core/controls";
import { PreviewFrame, type PreviewAction } from "@wssto2/vue-core/content";
import { TabbedSheet, type SheetTab } from "@wssto2/vue-core/modal";
import { WorkbenchPage, type PageAction } from "@wssto2/vue-core/page";
import { computed, onMounted, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { workbenchRoutes } from "../routes";

const { t } = useI18n();
const route = useRoute();

const mode = ref("edit");
const modes = computed(() => [{ value: "edit", label: t("workbench.edit") }, { value: "preview", label: t("workbench.preview") }, { value: "code", label: t("workbench.code") }]);
const order = ref([{ id: "hero", name: "Hero" }, { id: "about", name: "O nama" }, { id: "references", name: "Odabrane reference" }]);
const editing = ref("about");
const tab = ref<"content" | "order">("content");
// `?error=1` marks the first tab as failed, to see the mark.
const tabs = computed<SheetTab<"content" | "order">[]>(() => [
  { value: "content", label: t("workbench.content"), error: route.query.error ? t("workbench.title_error") : undefined },
  { value: "order", label: t("workbench.order") },
]);
const sheet = useTemplateRef<{ present: () => void; dismiss: () => void }>("sheet");
const actions = computed<PageAction[]>(() => [{ id: "settings", label: t("workbench.page_settings"), icon: "settings3Line", onClick: () => {} }]);

function onAction(action: PreviewAction) {
  if (action.type !== "edit") return;
  editing.value = action.id;
  sheet.value?.present();
}
// `?open=1` shows the editor with its sheet docked, as after a click on a component.
onMounted(() => { if (route.query.open) sheet.value?.present(); });
</script>

<template>
  <WorkbenchPage :title="t('workbench.page_name')" :description="t('workbench.page_meta')" :back="{ label: t('workbench.pages'), to: workbenchRoutes.page }" :actions="actions">
    <template #subheader><Tabs v-model="mode" class="w-fit" :tabs="modes" /></template>
    <template #start>
      <div class="flex h-full min-h-0">
        <div class="min-w-0 flex-1"><PreviewFrame src="/preview.html" :title="t('workbench.preview')" @message="onAction" /></div>
        <TabbedSheet ref="sheet" v-model:tab="tab" :tabs="tabs" :title="t('workbench.component')" docked size="md">
          <template #default="{ tab: current }">
            <p v-if="current === 'content'" class="text-body text-content">{{ t("workbench.title_field") }}: {{ editing }}</p>
            <SortableList v-else v-model="order" item-key="id" :label="t('workbench.components')" :item-label="(item) => item.name">
              <template #item="{ item }"><span class="text-body text-content-strong">{{ item.name }}</span></template>
            </SortableList>
          </template>
          <template #footer>
            <div class="flex justify-end gap-2">
              <Button prominence="plain" @click="sheet?.dismiss()">{{ t("workbench.cancel") }}</Button>
              <Button prominence="primary" @click="sheet?.dismiss()">{{ t("workbench.save_changes") }}</Button>
            </div>
          </template>
        </TabbedSheet>
      </div>
    </template>
  </WorkbenchPage>
</template>
