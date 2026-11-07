# A page editor: a preview, a docked sheet, an order

The page editor shows the page in a `PreviewFrame`, lets the page tell the editor what the user did (the page draws an Edit button on each component), and edits the component in a sheet **docked** beside the preview: no scrim, the preview narrows and stays visible and usable.

<!-- example: docs/examples/workbench/PageEditor.vue -->
```vue
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
```

## Messages between the page and the editor

`PreviewFrame` accepts a message only when it comes from the iframe's own window **and** its origin is the one expected (by default the origin of `src`; `origin` overrides it). Anything else is ignored, so another window or a foreign page cannot make the editor delete a component. `@message` gets what `parse` accepts; the default reads a `PreviewAction`:

| `type` | fields | the user wants to |
|---|---|---|
| `edit`, `delete`, `duplicate` | `id` | edit, delete or duplicate a component |
| `add` | `after?` | add a component after another (none: at the start) |
| `reorder` | `id`, `to` | move a component to position `to` (from 0) |
| `copy-locale` | `id`, `from` | fill the component's language with another language's text |

The page's own script sends them with `window.parent.postMessage({ type: "edit", id }, editorOrigin)`. Another set of actions: pass `parse`, a function that returns your typed message or `null`, and the component's type parameters follow it. Towards the page, `frame.post({ type: "select", id })` (anything with a `type`) goes to the expected origin only.

## Sheet: sizes and docked

`Sheet` has `size="md" | "lg" | "xl"` (28, 36 and 48 rem; `md` is the old width) for the slide-over. `docked` makes it a non-modal panel in the page's own layout: put it as a flex child next to the content. There is no scrim, no scroll lock, no focus trap and nothing becomes inert; Escape closes it while focus is inside it, and focus goes back to what opened it. On phones, tablets and touch screens a docked sheet is the usual bottom sheet, because there is no room beside the page.

## TabbedSheet

A `Sheet` divided into tabs with one footer for all of them. `tabs` is `{ value, label, error? }[]`, `v-model:tab` the selected one. `error: true` (or a text) marks the tab with an icon whose name says "Has errors", so the user who saves from the first tab finds the failed field on the fourth. Every tab's content stays mounted (hidden when not selected), so fields keep their values; the default slot is called once per tab with its `value`. It takes the props of `Sheet` (`title`, `size`, `docked`, `grouped`) and has the same `present()` and `dismiss()`.

## SortableList

An ordered list with a drag handle on each row. The order is the `v-model` (a new array each time); `item-key` is a property name or a function, so rows keep their state while they move. Dragging with a pointer shows where the row will land and moves it on release. From the keyboard, Alt+↑ / Alt+↓ on the handle moves the row and keeps focus on it, and a live region says "Hero moved to position 2 of 5" (`item-label` is what the row is called; by default its key). `disabled` removes the handles for someone who may only look. Vertical lists only.
