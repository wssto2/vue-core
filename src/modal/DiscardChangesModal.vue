<script setup lang="ts">
import { useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import AlertDialog from "../overlay/AlertDialog.vue";

/**
 * "Unsaved changes": the question a dirty sheet or page asks before it is dismissed. A centred
 * alert on wide screens, an action sheet on phones. Closing it any way other than "Discard
 * changes" (Escape, the scrim, "Continue editing") emits `cancel`.
 *
 *   const discard = useTemplateRef("discard");
 *   <DiscardChangesModal ref="discard" @confirm="leave" @cancel="stay" />
 *   discard.value?.present()
 */
const emit = defineEmits<{
  confirm: [];
  cancel: [];
  /** The dialog closed, however it was closed (after confirm and cancel too). */
  dismissed: [];
}>();

const { t } = useI18n();
const dialog = useTemplateRef<{ present: () => void; dismiss: () => void }>("dialog");

defineExpose({ present: () => dialog.value?.present(), dismiss: () => dialog.value?.dismiss() });
</script>

<template>
  <AlertDialog ref="dialog" :title="t('core.discard_changes.title')" :message="t('core.discard_changes.body')" tone="critical"
    icon="errorWarningLine" presentation="action-sheet" :confirm-label="t('core.discard_changes.confirm')"
    :cancel-label="t('core.discard_changes.cancel')" @confirm="emit('confirm')" @cancel="emit('cancel')" @dismissed="emit('dismissed')" />
</template>
