<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { focusableWithin } from "../internal/focusable";
import Modal from "../modal/Modal.vue";
import AlertDialog from "../overlay/AlertDialog.vue";
import { DONE_BEAT_MS } from "../state/useWaitStatus";
import { focusFirstError } from "./focus";
import FormErrors from "./FormErrors.vue";
import { useLeaveGuard } from "./leaveGuard";
import type { Command, CommandQuestion } from "./useCommand";
import type { Form } from "./useForm";

/**
 * The dialog of a `useCommand`: its inputs in the default slot, one primary action that says what it is doing and then that it is done,
 * the failure in words above the fields, the field errors on the fields (the first one focused after a refused call). Closing with
 * typed input asks first. A call that went through closes the dialog after the "done" beat.
 *
 *   <CommandDialog :command="assign" :title="t('assign')" :confirm-label="t('assign')" :done-label="t('assigned')">
 *     <FormGroup><ComboField v-bind="assign.form.bind('assignee')" :label="t('assignee')" :search="findUsers" /></FormGroup>
 *   </CommandDialog>
 *
 * Another action beside the primary one goes in `#actions`; `run({ addAnother: true })` saves like the primary action and then,
 * instead of closing, opens the dialog again with fresh inputs (the command's defaults), so the next record can be entered
 * (the add-a-record recipe, `docs/recipes/forms.md`).
 *
 * A command with `ask` puts its question here, in an `AlertDialog` over the filled form, once the inputs check out: Cancel
 * returns to the form untouched and nothing is sent; the action runs the command, and a refusal then lands on the form like any other.
 */
const props = withDefaults(defineProps<{
  command: Pick<Command<object, unknown, unknown>, "open" | "run" | "dismiss" | "present"> & Partial<Pick<Command<object, unknown, unknown>, "question" | "answer">> & { readonly form: Pick<Form<object>, "dirty" | "submitting" | "failure" | "errors"> };
  title: string;
  subtitle?: string;
  /** What the primary action says: exactly what it does ("Assign"). */
  confirmLabel: string;
  /** Disables the primary action while true (a proposal still loading). The inputs, Cancel and the leave guard work as before, and `run()` does nothing. */
  confirmDisabled?: boolean;
  /** What it says once done; by default "Saved". */
  doneLabel?: string;
  /** What it says while working; by default "Saving…". */
  busyLabel?: string;
  /** Text above the fields: what the command does and to what. */
  message?: string;
  size?: "sm" | "md" | "lg";
  /** The name of a field for people, for errors that have no field on screen. */
  fieldLabel?: (field: string) => string;
}>(), { subtitle: undefined, confirmDisabled: false, doneLabel: undefined, busyLabel: undefined, message: undefined, size: "sm", fieldLabel: undefined });

const emit = defineEmits<{ done: [] }>();
defineSlots<{
  default?: () => unknown;
  /** More actions in the footer, beside Cancel and the primary one. */
  actions?: (scope: { run: (options?: { addAnother?: boolean }) => Promise<void>; busy: boolean }) => unknown;
}>();

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

async function run(options: { addAnother?: boolean } = {}) {
  if (props.confirmDisabled) return;
  await settle(await props.command.run(), options);
}

async function settle(result: Awaited<ReturnType<typeof props.command.run>>, options: { addAnother?: boolean } = {}) {
  if (result.status === "failed") {
    if (result.failure.kind === "invalid") await nextTick().then(() => focusFirstError(body.value ?? document));
    return;
  }
  if (result.status === "aborted") return;
  emit("done");
  if (options.addAnother) {
    props.command.present(); // fresh inputs, the dialog stays: the next record
    await nextTick();
    focusableWithin(body.value)[0]?.focus();
    return;
  }
  done.value = true;
  closing = setTimeout(() => props.command.dismiss(), DONE_BEAT_MS);
}

// The question: kept after it is answered so the alert does not go blank while it leaves.
const ask = useTemplateRef<{ present: () => void }>("ask");
const asked = ref<CommandQuestion | null>(null);
watch(() => props.command.question?.value, (question) => {
  if (!question) return;
  asked.value = question;
  void nextTick(() => ask.value?.present());
});
const answerYes = async () => {
  if (props.command.answer) await settle(await props.command.answer(true));
};
onBeforeUnmount(() => {
  if (closing) clearTimeout(closing);
});

const status = computed(() => (props.command.form.submitting.value ? "processing" : done.value ? "done" : "idle"));
</script>

<template>
  <Modal ref="modal" :size="props.size" grouped :title="props.title" :subtitle="props.subtitle" :before-dismiss="confirmDiscard" :primary-label="props.confirmLabel" :primary-disabled="props.confirmDisabled" :status="status"
    :processing-label="props.busyLabel ?? t('core.actions.saving')" :done-label="props.doneLabel ?? t('core.actions.saved')" @primary="run()" @dismissed="props.command.dismiss()">
    <template v-if="$slots.actions" #actions>
      <slot name="actions" :run="run" :busy="props.command.form.submitting.value" />
    </template>
    <div ref="body" class="flex min-w-0 flex-col gap-group-gap" data-test="command-dialog">
      <p v-if="props.message" class="text-body text-content-muted">{{ props.message }}</p>
      <FormErrors :form="props.command.form" :label="props.fieldLabel" :scope="body" />
      <slot />
    </div>
  </Modal>
  <AlertDialog v-if="asked" ref="ask" :title="asked.title" :message="asked.message" :confirm-label="asked.confirmLabel" :tone="asked.tone" :action="answerYes"
    @dismissed="void props.command.answer?.(false)" />
</template>
