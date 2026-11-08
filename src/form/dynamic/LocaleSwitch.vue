<script setup lang="ts">
import { nextTick, useId } from "vue";
import { useI18n } from "vue-i18n";

/** The language switch of a form in `localeMode: "form"`: a segmented control in a group's header. `failed` languages carry the error mark. */
const props = defineProps<{ locales: readonly string[]; active: string; failed: (locale: string) => boolean }>();
const emit = defineEmits<{ choose: [locale: string] }>();

const { t } = useI18n();
const base = useId();
const tabId = (locale: string) => `dynamic-locale-${locale}`;

function onKeydown(event: KeyboardEvent, index: number) {
  const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: props.locales.length - 1 }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  const target = props.locales[(next + props.locales.length) % props.locales.length];
  if (target === undefined) return;
  emit("choose", target);
  void nextTick(() => document.getElementById(tabId(target))?.focus());
}
</script>

<template>
  <div :id="base" role="tablist" :aria-label="t('core.form.dynamic.language')" class="flex shrink-0 gap-0.5 rounded-control bg-fill p-0.5" data-dynamic-locales>
    <button v-for="(locale, index) in props.locales" :id="tabId(locale)" :key="locale" type="button" role="tab" :aria-selected="locale === props.active" :tabindex="locale === props.active ? 0 : -1" :data-locale="locale" :data-error="props.failed(locale) || undefined"
      class="flex min-h-7 cursor-pointer items-center rounded-control px-2.5 py-1 text-footnote font-semibold uppercase text-content-muted transition-colors duration-motion-fast hover:text-content-strong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus aria-selected:bg-segment-selected aria-selected:text-content-strong aria-selected:shadow-sm data-[error]:text-status-danger-content"
      @click="emit('choose', locale)" @keydown="onKeydown($event, index)">{{ locale }}</button>
  </div>
</template>
