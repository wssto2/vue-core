<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { PreviewFrame, type PreviewAction } from "@wssto2/vue-core/content";
import { SortableList } from "@wssto2/vue-core/controls";
import { TabbedSheet, type SheetTab } from "@wssto2/vue-core/modal";
import { WorkbenchPage } from "@wssto2/vue-core/page";
import { computed, ref, useTemplateRef } from "vue";

interface PageComponent {
  id: string;
  name: string;
}

const props = defineProps<{ title: string; previewUrl: string; components: PageComponent[]; save: (components: PageComponent[]) => Promise<unknown>; titleError?: string }>();

const order = ref(props.components);
const tab = ref<"content" | "order">("content");
const editing = ref<string | null>(null);
const sheet = useTemplateRef<{ present: () => void }>("sheet");
const tabs = computed<SheetTab<"content" | "order">[]>(() => [
  { value: "content", label: "Content", error: props.titleError },
  { value: "order", label: "Order" },
]);

// The page inside the frame draws an Edit button on each component and posts what the user did.
function onAction(action: PreviewAction) {
  if (action.type !== "edit") return;
  editing.value = action.id;
  sheet.value?.present();
}
</script>

<template>
  <WorkbenchPage :title="props.title" :back="{ label: 'Pages', to: '/pages' }">
    <template #start>
      <!-- A docked sheet is a flex child beside the page: the preview narrows to make room, and stays usable. -->
      <div class="flex h-full min-h-0">
        <div class="min-w-0 flex-1"><PreviewFrame :src="props.previewUrl" title="Page preview" @message="onAction" /></div>
        <TabbedSheet ref="sheet" v-model:tab="tab" :tabs="tabs" :title="`Component ${editing ?? ''}`" docked size="md">
          <template #default="{ tab: current }">
            <p v-if="current === 'content'">Fields of {{ editing }}</p>
            <SortableList v-else v-model="order" item-key="id" label="Components" :item-label="(item) => item.name">
              <template #item="{ item }">{{ item.name }}</template>
            </SortableList>
          </template>
          <template #footer><Button prominence="primary" @click="props.save(order)">Save changes</Button></template>
        </TabbedSheet>
      </div>
    </template>
  </WorkbenchPage>
</template>
