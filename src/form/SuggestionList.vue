<script setup lang="ts" generic="Value extends string | number">
import { computed, nextTick, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Icon } from "../icon";
import { useAnchoredPosition } from "../overlay/anchored";
import type { SelectOption } from "./options";
import { listShows, matchParts, type SuggestionStatus } from "./suggestions";

/**
 * The list under a field that suggests while typing (`TextField :suggestions`, `ComboField`): the matched part of each
 * row in bold, a second line for the detail, the recent choices under their heading before anything is typed, the
 * loading, failed and empty states, a line naming the keys. The field owns the input and the keys; this is the panel.
 */
const props = defineProps<{
  /** The input's id: the list and its rows are named from it (`aria-controls`, `aria-activedescendant`). */
  id: string;
  anchor: HTMLElement | null;
  open: boolean;
  items: readonly SelectOption<Value>[];
  highlighted: number;
  query: string;
  status: SuggestionStatus;
  /** The items are the recent choices, not an answer. */
  recent: boolean;
  /** Says "No matches" when the answer is empty. Free text stays quiet: a new city is not an error. */
  emptyMessage: boolean;
  /** The line of keys under the list (hidden on touch screens). */
  hint?: string;
}>();

const emit = defineEmits<{ pick: [option: SelectOption<Value>]; hover: [index: number] }>();

const { t } = useI18n();
const panel = useTemplateRef<HTMLElement>("panel");

const visible = computed(() => listShows(props.open, props.items.length, props.status, props.emptyMessage));
const busy = computed(() => props.status === "loading");
const marked = (option: SelectOption<Value>) => matchParts(option.label, props.query);

const { style } = useAnchoredPosition(panel, {
  reference: () => props.anchor,
  placement: () => "bottom-start",
  offset: 4,
  padding: 8,
  fit: (floating, available) => {
    floating.style.width = `${props.anchor?.offsetWidth ?? 0}px`;
    floating.style.maxHeight = `${Math.max(120, Math.min(320, available.height))}px`;
  },
});

watch(() => props.highlighted, () => void nextTick(() => panel.value?.querySelector("[aria-selected='true']")?.scrollIntoView?.({ block: "nearest" })));
</script>

<template>
  <!-- A press on a row must not blur the input first: mousedown is taken here. -->
  <div v-if="visible" :id="`${props.id}-list`" ref="panel" role="listbox" :aria-busy="busy || undefined" :style="style" data-test="suggestion-list"
    class="z-1000 flex flex-col overflow-hidden rounded-menu bg-surface-overlay shadow-float" @mousedown.prevent>
    <div class="min-h-0 flex-1 overflow-y-auto p-1.5">
      <p v-if="props.recent" class="px-2.5 pb-1 pt-1.5 text-caption font-semibold uppercase text-content-disabled" role="presentation">{{ t("core.form.suggestions.recent") }}</p>
      <template v-if="props.items.length > 0">
        <div v-for="(option, index) in props.items" :id="`${props.id}-option-${index}`" :key="String(option.value)" role="option" :aria-selected="index === props.highlighted"
          :aria-disabled="option.disabled || undefined" data-test="suggestion-option" class="flex cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-2"
          :class="[index === props.highlighted ? 'bg-tint-soft' : 'hover:bg-fill', option.disabled ? 'cursor-not-allowed opacity-45' : '', busy ? 'opacity-60' : '']"
          @mouseenter="emit('hover', index)" @click="!option.disabled && emit('pick', option)">
          <Icon v-if="props.recent" name="history" :size="16" class="shrink-0 text-content-disabled" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-body text-content-strong">
              <template v-if="props.recent">{{ option.label }}</template>
              <template v-else>{{ marked(option).before }}<strong v-if="marked(option).match" class="font-semibold">{{ marked(option).match }}</strong>{{ marked(option).after }}</template>
            </span>
            <span v-if="option.description" class="block truncate text-footnote text-content-muted">{{ option.description }}</span>
          </span>
        </div>
      </template>
      <p v-else-if="props.status === 'loading'" class="px-3 py-2 text-footnote text-content-muted" role="status">{{ t("core.form.select.loading") }}</p>
      <p v-else-if="props.status === 'failed'" class="px-3 py-2 text-footnote text-content-destructive" role="alert">{{ t("core.form.select.failed") }}</p>
      <p v-else class="px-3 py-2 text-footnote text-content-muted">{{ t("core.form.select.no_matches") }}</p>
    </div>
    <p v-if="props.hint && props.items.length > 0" class="mx-1.5 mb-1.5 mt-0.5 border-t border-border-separator px-2.5 pb-0.5 pt-2 text-caption text-content-muted compact:hidden" aria-hidden="true">{{ props.hint }}</p>
  </div>
</template>
