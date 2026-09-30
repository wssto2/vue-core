<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import Modal from "../modal/Modal.vue";
import { DONE_BEAT_MS } from "../state/useWaitStatus";
import { focusFirstError } from "./focus";
import FormErrors from "./FormErrors.vue";
import { useLeaveGuard } from "./leaveGuard";
import type { Command } from "./useCommand";
import type { Form } from "./useForm";

/**
 * The dialog of a `useCommand`: its inputs in the default slot, one primary action that says what it is doing and then that it is done,
 * the failure in words above the fields, the field errors on the fields (the first one focused after a refused call). Closing with
 * typed input asks first. A call that went through closes the dialog after the "done" beat.
 *
 *   <CommandDialog :command="assign" :title="t('assign')" :confirm-label="t('assign')" :done-label="t('assigned')">
 *     <FormGroup><ComboField v-bind="assign.form.bind('assignee')" :label="t('assignee')" :search="findUsers" /></FormGroup>
 *   </CommandDialog>
 */
const props = withDefaults(defineProps<{
  command: Pick<Command<object, unknown, unknown>, "open" | "run" | "dismiss"> & { readonly form: Pick<Form<object>, "dirty" | "submitting" | "failure" | "errors"> };
  title: string;
  subtitle?: string;
  /** What the primary action says: exactly what it does ("Assign"). */
  confirmLabel: string;
  /** What it says once done; by default "Saved". */
  doneLabel?: string;
  /** What it says while working; by default "Saving…". */
  busyLabel?: string;
  /** Text above the fields: what the command does and to what. */
  message?: string;
  size?: "sm" | "md" | "lg";
  /** The name of a field for people, for errors that have no field on screen. */
  fieldLabel?: (field: string) => string;
}>(), { subtitle: undefined, doneLabel: undefined, busyLabel: undefined, message: undefined, size: "sm", fieldLabel: undefined });

const emit = defineEmits<{ done: [] }>();
defineSlots<{ default?: () => unknown }>();

const { t } = useI18n();
const modal = useTemplateRef<{ present: () => void; dismiss: () => void }>("modal");
const body = useTemplateRef<HTMLElement>("body");
const done = ref(false);
let closing: ReturnType<typeof setTimeout> | null = null;

const { confirmDiscard } = useLeaveGuard(() => props.command.open.value && props.command.form.dirty.value);

watch(() => props.command.open.value, (open) => {
  if (open) {
    done.value = false;
    modal.value?.present();
  } else modal.value?.dismiss();
});

async function run() {
  const result = await props.command.run();
  if (result.status === "failed") {
    if (result.failure.kind === "invalid") await nextTick().then(() => focusFirstError(body.value ?? document));
    return;
  }
  if (result.status === "aborted") return;
  done.value = true;
  emit("done");
  closing = setTimeout(() => props.command.dismiss(), DONE_BEAT_MS);
}
onBeforeUnmount(() => {
  if (closing) clearTimeout(closing);
});

const status = computed(() => (props.command.form.submitting.value ? "processing" : done.value ? "done" : "idle"));
</script>

<template>
  <Modal ref="modal" :size="props.size" grouped :title="props.title" :subtitle="props.subtitle" :before-dismiss="confirmDiscard" :primary-label="props.confirmLabel" :status="status"
    :processing-label="props.busyLabel ?? t('core.actions.saving')" :done-label="props.doneLabel ?? t('core.actions.saved')" @primary="run" @dismissed="props.command.dismiss()">
    <div ref="body" class="flex min-w-0 flex-col gap-group-gap" data-test="command-dialog">
      <p v-if="props.message" class="text-body text-content-muted">{{ props.message }}</p>
      <FormErrors :form="props.command.form" :label="props.fieldLabel" :scope="body" />
      <slot />
    </div>
  </Modal>
</template>
