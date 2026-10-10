<script setup lang="ts" generic="Value extends string | number, Meta = undefined">
import { computed, nextTick, ref, shallowRef, useId, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Icon } from "../icon";
import ToneDot from "../state/ToneDot.vue";
import { groupOptions, matchOptions, type OptionSlotScope, type OptionWithMeta, type SelectOption } from "./options";
import type { SuggestionStatus } from "./suggestions";

/**
 * The options of a select as a list to pick from, with a search box once there are many: finger-height rows, a
 * check on the chosen one, groups, arrow-key navigation. The select opens it in a popover on wide screens and in
 * a sheet on phones; a filter drill-down or your own picker can use it the same way.
 *
 *   <OptionList :options="statuses" :model-value="status" @select="status = $event" />
 *
 * Single: picking emits the value. `multiple`: rows toggle and emit the toggled value.
 *
 * A list that loads (`useOptions`) passes its `status`: while `loading` the list says so instead of listing, and `failed` says
 * so with a "Try again" row (`@retry`).
 */
const props = withDefaults(defineProps<{
  options: readonly SelectOption<Value, Meta>[];
  /** The chosen value, or the chosen values when `multiple`. */
  modelValue?: Value | null | readonly Value[];
  multiple?: boolean;
  /** Shows the search box from this many options. */
  searchFrom?: number;
  /** A first row meaning "no value". */
  noneLabel?: string;
  /** `grouped` lists sit on the canvas of a sheet; `plain` in a popover. */
  presentation?: "grouped" | "plain";
  /** Where the options are in loading; anything but `loaded` and `idle` replaces the rows with a line saying so. */
  status?: SuggestionStatus;
}>(), { modelValue: null, multiple: false, searchFrom: 9, noneLabel: undefined, presentation: "grouped", status: "loaded" });

const emit = defineEmits<{ select: [value: Value | null]; retry: [] }>();
defineSlots<{
  /** Replaces what a row says (the dot, label and description): an icon, a badge. The row, its check, keys and roles stay. */
  option?: (scope: OptionSlotScope<Value, Meta>) => unknown;
}>();
const focused = shallowRef<Value | null>(null);
const withMeta = (option: SelectOption<Value, Meta>) => option as OptionWithMeta<Value, Meta>; // the app promised a `meta` on every option it reads in the slot
const focus = (value: Value | null) => void (focused.value = value);
const isFocused = (option: SelectOption<Value, Meta>) => focused.value === option.value;

const { t } = useI18n();
const query = ref("");
const listId = useId();
const root = useTemplateRef<HTMLElement>("root");

const showSearch = computed(() => props.options.length >= props.searchFrom);
const visible = computed(() => groupOptions(matchOptions(props.options, query.value)));
const chosen = (option: SelectOption<Value, Meta>) => (props.multiple ? Array.isArray(props.modelValue) && (props.modelValue as readonly Value[]).includes(option.value) : props.modelValue === option.value);
const nothingChosen = computed(() => (props.multiple ? false : props.modelValue === null));

function move(event: KeyboardEvent) {
  const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
  if (!keys.includes(event.key)) return;
  const items = [...(root.value?.querySelectorAll<HTMLElement>("[data-option]:not([disabled])") ?? [])];
  if (items.length === 0) return;
  const at = items.indexOf(document.activeElement as HTMLElement);
  const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" ? Math.min(at + 1, items.length - 1) : Math.max(at - 1, 0);
  // From the search box, ArrowDown enters the list; ArrowUp from the first row returns to the box.
  if (event.key === "ArrowUp" && at <= 0) root.value?.querySelector<HTMLElement>("[data-option-search]")?.focus();
  else items[at === -1 && event.key === "ArrowDown" ? 0 : next]?.focus();
  event.preventDefault();
}

const grouped = computed(() => props.presentation === "grouped");
const loading = computed(() => props.status === "loading");
const failed = computed(() => props.status === "failed");

// A list opened while it loads has nothing to focus yet: when the answer lands, the keyboard moves in (unless the user already went somewhere in it).
watch(() => props.status, (status, before) => {
  if (before !== "loading" || status === "loading") return;
  void nextTick(() => {
    const active = document.activeElement;
    const outside = !active || active === document.body || (active.getAttribute("role") === "dialog" && !!root.value && active.contains(root.value));
    if (outside) root.value?.querySelector<HTMLElement>("[data-option-search], [data-option]:not([disabled])")?.focus({ preventScroll: true });
  });
});
</script>

<template>
  <div ref="root" data-test="option-list" @keydown="move">
    <div v-if="showSearch" class="sticky top-0 z-10 pb-2" :class="grouped ? 'bg-surface-page pt-1' : 'bg-surface-cell'">
      <label class="flex min-h-9 items-center gap-1.5 rounded-control bg-fill px-2.5 text-content-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-border-focus">
        <Icon name="search" :size="16" class="shrink-0" />
        <input v-model="query" data-option-search type="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" :aria-label="t('core.form.select.search')"
          :placeholder="t('core.form.select.search')" class="min-w-0 flex-1 border-0 bg-transparent p-0 text-body text-content-strong outline-none placeholder:text-content-disabled focus:ring-0" />
      </label>
    </div>

    <ul class="flex flex-col" :class="grouped ? 'gap-group-gap' : 'gap-2'" role="listbox" :aria-multiselectable="props.multiple || undefined" :aria-busy="loading || undefined">
      <li v-if="props.noneLabel && query === ''" role="presentation">
        <ul role="group" :class="grouped ? 'rounded-group bg-surface-cell shadow-group' : ''">
          <li role="option" :aria-selected="nothingChosen">
            <button type="button" data-option class="flex min-h-row w-full cursor-pointer items-center gap-3 px-row-inset text-left text-body hover:bg-fill focus-visible:bg-fill focus-visible:outline-none active:bg-fill"
              :class="[nothingChosen ? 'text-content-strong' : 'text-content-muted', grouped ? 'rounded-group' : 'rounded-control']" @click="emit('select', null)">
              <span class="flex-1 py-2">{{ props.noneLabel }}</span>
              <Icon v-if="nothingChosen" name="checkCustom" :size="18" class="shrink-0 text-content-link" />
            </button>
          </li>
        </ul>
      </li>

      <li v-if="loading" role="presentation" class="flex items-center gap-2.5 px-row-inset py-4 text-subheadline text-content-muted" data-test="options-loading">
        <Icon name="loader4Line" :size="16" class="shrink-0 animate-spin text-content-link" />
        <span role="status">{{ t("core.form.select.loading") }}</span>
      </li>
      <li v-else-if="failed" role="presentation" class="flex flex-col items-start gap-1 px-row-inset py-3" data-test="options-failed">
        <span role="alert" class="text-subheadline text-content-destructive">{{ t("core.form.select.load_failed") }}</span>
        <button type="button" data-option data-test="options-retry" class="-ml-2 cursor-pointer rounded-control px-2 py-1 text-subheadline font-medium text-content-link hover:bg-fill focus-visible:bg-fill focus-visible:outline-none" @click="emit('retry')">
          {{ t("core.actions.retry") }}
        </button>
      </li>

      <li v-for="(section, sectionIndex) in visible" :key="section.title ?? sectionIndex" role="presentation">
        <p v-if="section.title" :id="`${listId}-${sectionIndex}`" class="px-row-inset pb-1.5 text-footnote uppercase tracking-wide text-content-muted">{{ section.title }}</p>
        <ul role="group" :aria-labelledby="section.title ? `${listId}-${sectionIndex}` : undefined" :class="grouped ? 'rounded-group bg-surface-cell shadow-group' : ''">
          <li v-for="option in section.options" :key="String(option.value)" role="option" :aria-selected="chosen(option)" class="group/option">
            <button type="button" data-option data-test="option" :disabled="option.disabled"
              class="flex w-full cursor-pointer items-stretch gap-3 pl-row-inset text-left text-body hover:bg-fill focus-visible:bg-fill focus-visible:outline-none active:bg-fill disabled:cursor-not-allowed disabled:opacity-45"
              :class="grouped ? 'group-first/option:rounded-t-group group-last/option:rounded-b-group' : 'rounded-control'" @focus="focus(option.value)" @blur="focus(null)" @click="emit('select', option.value)">
              <span v-if="props.multiple" aria-hidden="true" class="flex shrink-0 items-center">
                <span class="flex size-5.5 items-center justify-center rounded-full border" :class="chosen(option) ? 'border-control-on bg-control-on text-white' : 'border-border-control'">
                  <Icon v-if="chosen(option)" name="checkCustom" :size="12" />
                </span>
              </span>
              <span class="flex min-h-row min-w-0 flex-1 items-center gap-3 py-2 pr-row-inset" :class="grouped ? 'border-t border-border-separator group-first/option:border-t-0' : ''">
                <slot name="option" :option="withMeta(option)" :active="isFocused(option)" :selected="chosen(option)">
                  <ToneDot v-if="option.dot" :tone="option.dot" class="-mr-1.5" />
                  <span class="min-w-0 flex-1 text-content-strong">{{ option.label }}</span>
                  <span v-if="option.description" class="shrink-0 text-footnote text-content-muted">{{ option.description }}</span>
                </slot>
                <Icon v-if="!props.multiple && chosen(option)" name="checkCustom" :size="18" class="shrink-0 text-content-link" />
              </span>
            </button>
          </li>
        </ul>
      </li>

      <li v-if="visible.length === 0 && !loading && !failed" class="px-4 py-6 text-center text-subheadline text-content-muted">{{ t("core.form.select.no_matches") }}</li>
    </ul>
  </div>
</template>
