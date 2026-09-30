<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";

/**
 * A one-time code entered into a row of boxes, one per digit. It is one real `<input>` laid transparently over
 * painted cells, not an input per digit: a single input keeps paste, SMS and e-mail code autofill
 * (`autocomplete="one-time-code"`), screen readers, IME and mobile keyboards working with no focus juggling. Only
 * digits are kept, so a pasted "123 456" or "123-456" fills all six boxes. `complete` fires when the last digit lands.
 *
 *   <OtpInput v-model="code" :invalid="!!error" @complete="verify" />
 *
 * It is the control, not a labelled field: give it an accessible `label` (by default "Verification code, N digits").
 */
const props = withDefaults(
  defineProps<{
    length?: number;
    disabled?: boolean;
    invalid?: boolean;
    autofocus?: boolean;
    name?: string;
    /** The accessible name. */
    label?: string;
    /** The id of the element that describes the error. */
    describedBy?: string;
  }>(),
  { length: 6, disabled: false, invalid: false, autofocus: false, name: undefined, label: undefined, describedBy: undefined },
);

const model = defineModel<string>({ default: "" });
const emit = defineEmits<{ complete: [code: string] }>();

const { t } = useI18n();
const id = useId();
const input = useTemplateRef<HTMLInputElement>("input");
const focused = ref(false);
const caret = ref(0);
// True while the wrong-code shake plays; re-armed on every change to invalid (the class must come off for a frame for the animation to replay).
const shaking = ref(false);

const sanitize = (value: string) => value.replace(/\D/g, "").slice(0, props.length);
const digits = computed(() => sanitize(model.value));
const activeIndex = computed(() => Math.min(caret.value, props.length - 1));
const accessibleName = computed(() => props.label ?? t("core.form.otp.label", { length: props.length }));

function syncCaret() {
  caret.value = input.value?.selectionStart ?? digits.value.length;
}

function commit(value: string) {
  const next = sanitize(value);
  if (input.value && input.value.value !== next) input.value.value = next;
  const changed = next !== digits.value;
  model.value = next;
  void nextTick(syncCaret);
  if (changed && next.length === props.length) emit("complete", next);
}

function onPaste(event: ClipboardEvent) {
  const pasted = event.clipboardData?.getData("text") ?? "";
  if (!pasted) return;
  event.preventDefault();
  commit(pasted);
  void nextTick(() => {
    const end = digits.value.length;
    input.value?.setSelectionRange(end, end);
    syncCaret();
  });
}

watch(
  () => props.invalid,
  (invalid) => {
    if (!invalid) return;
    shaking.value = false;
    requestAnimationFrame(() => (shaking.value = true));
  },
);

// The input is uncontrolled between keystrokes: a parent that clears a wrong code must reach the DOM too.
watch(digits, (value) => {
  if (input.value && input.value.value !== value) {
    input.value.value = value;
    void nextTick(syncCaret);
  }
});

onMounted(() => {
  if (props.autofocus) input.value?.focus();
});

defineExpose({ focus: () => input.value?.focus() });
</script>

<template>
  <div class="relative inline-flex gap-2 sm:gap-3" :class="{ 'motion-safe:animate-shake': shaking }" data-test="otp-input" @animationend="shaking = false">
    <input :id="id" ref="input" :value="digits" :name="props.name" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="\d*" spellcheck="false" :disabled="props.disabled"
      :aria-label="accessibleName" :aria-invalid="props.invalid || undefined" :aria-describedby="props.describedBy" data-test="otp-input-field"
      class="absolute inset-0 z-10 h-full w-full cursor-text border-0 bg-transparent p-0 text-base text-transparent caret-transparent outline-none selection:bg-transparent disabled:cursor-not-allowed"
      @input="commit(($event.target as HTMLInputElement).value)" @paste="onPaste" @focus="focused = true; syncCaret()" @blur="focused = false" @keyup="syncCaret" @click="syncCaret" @select="syncCaret" />

    <div v-for="index in props.length" :key="index" aria-hidden="true" data-test="otp-input-cell"
      class="flex size-11 items-center justify-center rounded-control bg-fill text-lg font-medium tabular-nums text-content-strong transition-[box-shadow] sm:size-13 sm:text-xl"
      :class="[props.invalid ? 'bg-status-danger-surface ring-[1.5px] ring-inset ring-border-destructive' : focused && activeIndex === index - 1 ? 'bg-surface-cell ring-[1.5px] ring-inset ring-border-focus outline-3 outline-border-focus/20' : '', props.disabled ? 'opacity-45' : '']">
      <template v-if="digits[index - 1]">{{ digits[index - 1] }}</template>
      <span v-else-if="focused && activeIndex === index - 1" class="h-5 w-px animate-caret-blink bg-content-strong" />
    </div>
  </div>
</template>
