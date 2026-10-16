<script setup lang="ts" generic="Row, Options extends PickerOptions">
import { useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Modal } from "../modal";
import type { Picker, PickerOptions } from "./picker";

/**
 * The dialog of a `createPicker()`: opens when something calls `picker.pick(...)`, and closes with the
 * chosen row or without one. Its body is yours, mounted afresh each time it opens, so the list asks
 * for its rows then and starts clean; `select(row)` hands the choice back.
 *
 *   <PickerModal :picker="userPicker" :title="t('users.assign')" v-slot="{ options, select }">
 *     <UserList :location-id="options.locationId" @pick="select" />   <!-- a CollectionTable with :pick -->
 *   </PickerModal>
 *
 * Mount it once, anywhere the app keeps its dialogs. A title given to `pick` wins over `title`.
 */
const props = withDefaults(defineProps<{
  picker: Picker<Row, Options>;
  /** The dialog's title. Default "Choose one". */
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl";
}>(), { title: undefined, description: undefined, size: "lg" });

defineSlots<{
  /** The list to choose from. */
  default?: (scope: { options: Options; select: (row: Row) => void }) => unknown;
}>();

const { t } = useI18n();
const modal = useTemplateRef<InstanceType<typeof Modal>>("modal");

// The dialog follows the picker's state, whoever changed it (a choice, a cancel, a new `pick`). Only a dismissal the
// person made (Escape, Cancel, a swipe) cancels: one this component made already knows its answer.
let shown = false;
let closing = false;
watch(() => props.picker.state.value.open, (open) => {
  if (open) {
    shown = true;
    modal.value?.present();
  } else if (shown) {
    closing = true;
    void modal.value?.dismiss();
  }
}, { flush: "post" });

function dismissed() {
  shown = false;
  if (closing) closing = false;
  else props.picker.cancel();
}
</script>

<template>
  <Modal ref="modal" :title="props.picker.state.value.options?.title ?? props.title ?? t('core.collection.pick_label')"
    :subtitle="props.picker.state.value.options?.description ?? props.description" :size="props.size" grouped
    @dismissed="dismissed">
    <slot v-if="props.picker.state.value.options" :options="props.picker.state.value.options" :select="props.picker.select" />
  </Modal>
</template>
