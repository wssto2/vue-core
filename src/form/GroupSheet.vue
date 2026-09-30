<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import Modal from "../modal/Modal.vue";
import Banner from "../state/Banner.vue";
import { DONE_BEAT_MS } from "../state/useWaitStatus";
import FormErrors from "./FormErrors.vue";
import type { GroupSheetState } from "./useGroupSheet";

/**
 * The sheet of one record group (decision D22): a grouped `Modal` with one Save and the lifecycle of `useGroupSheet`. The
 * group's values are its baseline on open and are put back on Cancel; a dismiss with edits asks first; a save says what it is
 * doing, then that it is done, before the sheet closes. The fields go in the default slot, bound to the record's form as on its
 * page. A save that needs another group's data says which at the top; a failure says why.
 *
 *   <GroupSheet :sheet="contact" :title="t('contact')" :editable="canEdit" :group-label="(group) => t('group.' + group)">
 *     <RecordGroupScope only="contact" :editable="canEdit"><ContactSections :form="form" /></RecordGroupScope>
 *   </GroupSheet>
 *   <Button @click="contact.present()">Edit</Button>
 */
const props = withDefaults(defineProps<{
  sheet: GroupSheetState<string>;
  title: string;
  subtitle?: string;
  /** Offers Save; without it the sheet reads (Close only). */
  editable: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  /** The name of a group, for the banner ("Owner"). */
  groupLabel: (group: string) => string;
  /** The name of a field for people, for errors that have no field on screen. */
  fieldLabel?: (field: string) => string;
}>(), { subtitle: undefined, size: "md", fieldLabel: undefined });

const emit = defineEmits<{ saved: [] }>();
defineSlots<{ default?: () => unknown }>();

const { t } = useI18n();
const modal = useTemplateRef<{ present: () => void; dismiss: () => void }>("modal");
const body = useTemplateRef<HTMLElement>("body");
// The save says what it is doing, then that it is done, before the sheet closes.
const done = ref(false);
let closing: ReturnType<typeof setTimeout> | null = null;

watch(() => props.sheet.open.value, (open) => {
  if (open) {
    done.value = false;
    modal.value?.present();
  } else modal.value?.dismiss();
});
onMounted(() => {
  if (props.sheet.open.value) modal.value?.present();
});
onBeforeUnmount(() => {
  if (closing) clearTimeout(closing);
});

async function save() {
  if (!(await props.sheet.save())) return;
  done.value = true;
  emit("saved");
  closing = setTimeout(() => props.sheet.dismiss(), DONE_BEAT_MS);
}

const status = computed(() => (props.sheet.saving.value ? "processing" : done.value ? "done" : "idle"));
</script>

<template>
  <Modal ref="modal" :size="props.size" grouped :title="props.title" :subtitle="props.subtitle" :before-dismiss="props.sheet.beforeDismiss" :primary-label="props.editable ? t('core.actions.save') : undefined"
    :status="status" :processing-label="t('core.actions.saving')" :done-label="t('core.actions.saved')" @primary="save" @dismissed="props.sheet.closed()">
    <div ref="body" class="flex min-w-0 flex-col gap-group-gap">
      <Banner v-if="props.sheet.notice.value" tone="warning" data-test="group-sheet-notice"><p class="text-footnote">{{ props.sheet.notice.value }}</p></Banner>
      <Banner v-if="props.sheet.foreignGroups.value.length" tone="warning" data-test="group-sheet-foreign">
        <p class="text-footnote">{{ t("core.form.group.foreign", { groups: props.sheet.foreignGroups.value.map(props.groupLabel).join(", ") }) }}</p>
      </Banner>
      <FormErrors :form="props.sheet.form" :label="props.fieldLabel" :scope="body" />
      <slot />
    </div>
  </Modal>
</template>
