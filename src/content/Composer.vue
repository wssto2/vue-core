<script setup lang="ts">
import { computed, nextTick, useId, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Icon } from "../icon";

/**
 * The message field under an activity stream: a capsule text area that grows with its text and a
 * round send button that turns tinted once there is something to send.
 *
 *   <Composer v-model="draft" :processing="posting" @submit="post" />
 *
 * Enter adds a line (comments are prose); Ctrl or ⌘ + Enter sends. `submit` carries the trimmed
 * text; the owner clears the draft once it is saved, so a failed request keeps what was typed.
 */
const props = withDefaults(defineProps<{
  placeholder?: string;
  /** Accessible name of the field; defaults to the placeholder. */
  label?: string;
  maxLength?: number;
  disabled?: boolean;
  processing?: boolean;
}>(), {
  placeholder: undefined,
  label: undefined,
  maxLength: 2000,
  disabled: false,
  processing: false,
});

const emit = defineEmits<{ submit: [text: string] }>();

const draft = defineModel<string>({ default: "" });

const { t } = useI18n();

const id = useId();
const field = useTemplateRef<HTMLTextAreaElement>("field");
const placeholderText = computed(() => props.placeholder ?? t("core.comments.placeholder"));
const canSend = computed(() => !props.disabled && !props.processing && draft.value.trim().length > 0);

// Grow with the text up to about eight lines, then scroll.
function resize() {
  const el = field.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
}
watch(draft, () => nextTick(resize));

function send() {
  if (canSend.value) emit("submit", draft.value.trim());
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    send();
  }
}

defineExpose({ focus: () => field.value?.focus() });
</script>

<template>
  <form data-test="composer" class="flex items-end gap-2" @submit.prevent="send">
    <label :for="id" class="sr-only">{{ props.label ?? placeholderText }}</label>
    <textarea :id="id" ref="field" v-model="draft" rows="1" :maxlength="props.maxLength" :placeholder="placeholderText"
      :disabled="props.disabled" data-test="composer-input"
      class="block max-h-48 min-h-10 min-w-0 flex-1 resize-none rounded-3xl border-0 bg-surface-cell px-3.5 py-2.5 text-body text-content-strong ring-1 ring-border-separator ring-inset placeholder:text-content-disabled focus:outline-2 focus:outline-offset-0 focus:outline-border-focus focus:ring-0 disabled:cursor-not-allowed disabled:bg-fill compact:min-h-[2.375rem] compact:py-2"
      @keydown="onKeydown" />
    <button type="submit" data-test="composer-send" :disabled="!canSend" :aria-label="t('core.comments.send')"
      class="hit-target relative mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full transition-colors duration-motion-fast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus compact:size-[2.125rem]"
      :class="canSend ? 'cursor-pointer bg-tint text-content-on-tint hover:bg-tint/90' : 'cursor-not-allowed bg-fill-strong text-surface-cell'">
      <Icon v-if="props.processing" name="loader4Line" :size="18" class="animate-spin" />
      <Icon v-else name="arrowUpSLine" :size="20" />
    </button>
  </form>
</template>
