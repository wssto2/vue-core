<script setup lang="ts" generic="Row">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useKeyboardShortcut } from "../button";
import { useFormat } from "../format";
import { Icon } from "../icon";
import { Menu, type MenuItem } from "../overlay";
import CollectionFilterMenu from "./CollectionFilterMenu.vue";
import CollectionFilterPanel from "./CollectionFilterPanel.vue";
import { appliedFilterCount, filterChips, type FilterChip } from "./filters";
import type { Collection } from "./useCollection";

/**
 * The toolbar of a list: search, the filter capsules, the "Filters" button with the applied panel
 * filters as removable tokens, saved views, and the page's own controls in the default slot.
 * Below 1024 px every filter the panel can edit moves into it, so the toolbar is a search field and
 * one "Filters (n)" button instead of rows of dropdowns.
 */
const props = defineProps<{
  collection: Collection<Row>;
  narrow: boolean;
  /** Phone rows sit on the canvas: the toolbar has no card of its own. */
  flat: boolean;
}>();

const emit = defineEmits<{ touched: [keys: string[]] }>();
defineSlots<{ default?: () => unknown }>();

const { t } = useI18n();
const format = useFormat();
const SEARCH_CHIP = "__search";

// --- search ----------------------------------------------------------------------

const MIN_SEARCH = 3;
const DEBOUNCE_MS = 300;
const text = ref(props.collection.query.value.search);
const field = useTemplateRef<HTMLInputElement>("field");
let timer: ReturnType<typeof setTimeout> | null = null;

// The field follows the state when it changes elsewhere (a saved view, back and forward, "clear all").
watch(() => props.collection.query.value.search, (value) => {
  if (value !== text.value.trim()) text.value = value;
});

function onInput() {
  if (timer) clearTimeout(timer);
  const value = text.value;
  // Results from three characters on, or when the field is emptied.
  if (value.length > 0 && value.length < MIN_SEARCH) return;
  timer = setTimeout(() => {
    timer = null;
    if (value === props.collection.query.value.search) return;
    emit("touched", [SEARCH_CHIP]);
    props.collection.search(value);
  }, DEBOUNCE_MS);
}

function clearSearch() {
  if (timer) clearTimeout(timer);
  text.value = "";
  emit("touched", [SEARCH_CHIP]);
  props.collection.search("");
  field.value?.focus();
}

onBeforeUnmount(() => timer && clearTimeout(timer));

// --- filters -----------------------------------------------------------------------

const inPanel = (filter: (typeof props.collection.filters.value)[number]) => filter.placement === "panel" || (props.narrow && filter.type !== "text");
const toolbarFilters = computed(() => props.collection.filters.value.filter((filter) => !inPanel(filter)));
const panelFilters = computed(() => props.collection.filters.value.filter(inPanel));
const selected = computed(() => props.collection.query.value.filters);

const chips = computed<FilterChip[]>(() =>
  filterChips(panelFilters.value, selected.value, {
    formatNumber: (value) => format.number(value),
    from: t("core.collection.filters.range_from"),
    until: t("core.collection.filters.range_until"),
  }),
);
const appliedCount = computed(() => appliedFilterCount(panelFilters.value, selected.value));

function updateFilter(key: string, value: string | null) {
  emit("touched", [key]);
  props.collection.setFilter(key, value);
}

function clearFilters(keys: string[]) {
  props.collection.setFilters(Object.fromEntries(keys.map((key) => [key, null])));
}

const panel = useTemplateRef<{ present(): void }>("panel");
const panelButton = useTemplateRef<HTMLButtonElement>("panelButton");

// Hidden lists (an inactive tab, a collapsed section) take no shortcuts.
const shown = (element: HTMLElement | null) => !!element && (typeof element.checkVisibility !== "function" || element.checkVisibility());
useKeyboardShortcut({ key: "/" }, () => {
  if (!shown(field.value)) return false;
  field.value?.focus();
  field.value?.select();
});
useKeyboardShortcut({ key: "f" }, () => {
  if (panelFilters.value.length === 0 || !shown(panelButton.value)) return false;
  panel.value?.present();
});

// --- saved views --------------------------------------------------------------------

const saved = computed(() => props.collection.savedViews);
onMounted(() => void saved.value?.load());
const savedItems = computed<MenuItem[]>(() =>
  (saved.value?.items.value ?? []).map((view) => ({
    id: `saved-${view.id}`,
    label: view.name,
    icon: "starFill" as const,
    onSelect: () => {
      emit("touched", []);
      saved.value?.apply(view);
    },
  })),
);
</script>

<template>
  <div :class="props.flat ? 'pb-3' : 'border-b border-border-separator px-3 py-2.5'" class="select-none" data-test="collection-toolbar">
    <div class="flex flex-col items-start gap-2 lg:flex-row">
      <div class="flex h-9 w-full items-center rounded-control bg-fill px-2.5 text-content-muted transition-colors duration-motion-fast focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-border-focus lg:w-72 compact:h-10">
        <Icon name="search" :size="16" />
        <input ref="field" v-model="text" type="text" name="collection-search" autocomplete="off" :placeholder="t('core.collection.search.placeholder')"
          :aria-label="t('core.collection.search.label')"
          class="peer block min-w-0 flex-1 bg-transparent px-2 py-1.5 text-body text-content-strong outline-0 placeholder:text-content-disabled" @input="onInput" />
        <!-- "/" hint: gone while focused, filled, or on touch devices without a keyboard. -->
        <kbd aria-hidden="true"
          class="rounded border border-border-separator px-1.5 font-mono text-2xs leading-5 text-content-disabled peer-focus:hidden peer-[:not(:placeholder-shown)]:hidden [@media(pointer:coarse)]:hidden">/</kbd>
        <button v-if="text !== ''" type="button" :aria-label="t('core.collection.clear')" class="cursor-pointer rounded-full text-content-disabled hover:text-content-muted" @click="clearSearch">
          <Icon name="close" :size="16" />
        </button>
      </div>

      <!-- Phones: one scrolling row of capsules instead of stacked dropdowns. -->
      <div class="flex min-w-0 flex-1 items-center gap-2" :class="props.narrow ? 'w-full flex-nowrap overflow-x-auto [scrollbar-width:none]' : 'flex-wrap'">
        <button v-if="panelFilters.length > 0" ref="panelButton" type="button" data-test="collection-filter-panel-button"
          :title="`${t('core.collection.filters.panel_button')} (F)`"
          class="hit-target inline-flex h-8 shrink-0 cursor-pointer items-center gap-x-1.5 rounded-button px-3 text-subheadline font-semibold transition-colors duration-motion-fast compact:h-9"
          :class="appliedCount > 0 ? 'bg-tint-soft text-content-link' : 'bg-surface-cell text-content-strong shadow-group ring-1 ring-inset ring-border-separator hover:bg-fill'"
          @click="panel?.present()">
          <Icon name="filter3" :size="16" />
          {{ t("core.collection.filters.panel_button") }}
          <span v-if="appliedCount > 0" class="min-w-4.5 rounded-full bg-tint px-1 text-center text-caption font-semibold leading-4.5 text-content-on-tint">{{ appliedCount }}</span>
        </button>

        <Menu v-if="savedItems.length > 0" :items="savedItems" :label="t('core.collection.saved.menu')" placement="bottom-start">
          <template #trigger="{ toggle, attrs }">
            <button v-bind="attrs" type="button" data-test="saved-filters-menu"
              class="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-button bg-surface-cell px-3 py-1.5 text-subheadline font-semibold text-content-strong shadow-group ring-1 ring-inset ring-border-separator transition-colors hover:bg-fill"
              @click="toggle">
              <Icon name="starFill" :size="14" class="text-status-warning-content" />
              {{ t("core.collection.saved.menu") }}
            </button>
          </template>
        </Menu>

        <CollectionFilterMenu v-for="filter in toolbarFilters" :key="filter.key" :filter="filter" :value="selected[filter.key]"
          @update="(value) => updateFilter(filter.key, value)" />
      </div>

      <slot />
    </div>

    <!-- Applied panel filters as removable tokens, on their own row so a long selection wraps under the toolbar. -->
    <div v-if="chips.length > 0" class="mt-2.5 flex flex-wrap items-center gap-2" data-test="collection-filter-chips">
      <span v-for="chip in chips" :key="chip.key"
        class="inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-control bg-tint-soft py-0.5 pr-0.5 pl-2.5 text-subheadline text-content-link">
        <span v-if="chip.label" class="shrink-0 opacity-80">{{ chip.label }}</span>
        <span class="flex min-w-0 flex-wrap items-center gap-1 font-semibold">
          <template v-for="(value, index) in chip.values" :key="index">
            <Icon v-if="index > 0" name="arrowRightSLine" :size="12" class="opacity-60" />
            <span class="break-words">{{ value }}</span>
          </template>
        </span>
        <button type="button" class="hit-target flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-tint/15"
          :aria-label="t('core.collection.clear')" @click="clearFilters(chip.clears)">
          <Icon name="close" :size="12" />
        </button>
      </span>

      <button v-if="chips.length > 1" type="button" class="cursor-pointer px-2 text-subheadline text-content-muted hover:text-content-strong hover:underline"
        @click="clearFilters(panelFilters.map((filter) => filter.key))">
        {{ t("core.collection.filters.reset_all") }}
      </button>
    </div>

    <CollectionFilterPanel v-if="panelFilters.length > 0" ref="panel" :collection="props.collection" :filters="panelFilters" @touched="(keys) => emit('touched', keys)" />
  </div>
</template>
