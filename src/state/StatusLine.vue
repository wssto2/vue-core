<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Icon } from "../icon";
import DrawnCheck from "./DrawnCheck.vue";

/**
 * The status line of a wait: what is happening now, in words that follow the real steps. Working,
 * the text shimmers beside a spinner and each new text swaps in; done, a checkmark draws beside a
 * still text. `elapsed` (whole seconds) shows once a wait is slow enough to be counted; the
 * default slot adds a way out ("Choose from the catalogue"). Announced politely, so a screen
 * reader hears each step once.
 *
 *   <StatusLine :text="t('searching')" :elapsed="wait.slow.value ? wait.elapsed.value : null" />
 *   <StatusLine :text="t('found', { count })" done />
 */
const props = defineProps<{
  text: string;
  done?: boolean;
  /** Whole seconds, shown at the end of the line; null hides them. */
  elapsed?: number | null;
}>();

defineSlots<{ default?: () => unknown }>();

const { t } = useI18n();
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1" :data-done="props.done || undefined">
    <div class="flex min-w-0 items-center gap-2.5 text-subheadline" role="status" aria-live="polite">
      <span v-if="props.done" class="text-content-link"><DrawnCheck :size="16" /></span>
      <Icon v-else name="loader4Line" :size="16" class="animate-spin text-content-link" />
      <span :key="props.text" class="min-w-0 animate-text-swap" :class="props.done ? 'font-semibold text-content-link' : 'text-shimmer'"
        data-status-text>{{ props.text }}</span>
      <span v-if="props.elapsed != null" class="ml-auto shrink-0 pl-2 text-footnote tabular-nums text-content-muted" data-status-elapsed>
        {{ t("core.wait.seconds", { count: props.elapsed }) }}
      </span>
    </div>
    <div v-if="$slots.default" class="pl-6.5 text-footnote"><slot /></div>
  </div>
</template>
