<script setup lang="ts" generic="Row">
import { computed, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import Button from "../button/Button.vue";
import { Tabs } from "../controls";
import type { Tone } from "../state";
import ToneDot from "../state/ToneDot.vue";
import NumberField from "../form/NumberField.vue";
import SelectField from "../form/SelectField.vue";
import { Icon } from "../icon";
import { useMediaQuery } from "../internal/mediaQuery";
import { Sheet } from "../modal";
import { Popover, toast } from "../overlay";
import { isApiError } from "../client";
import type { Collection } from "./useCollection";
import { isEmptyFilterValue, joinRange, narrowedOptions, splitRange, type FilterDescriptor } from "./filters";
import type { SavedView } from "./savedViews";

/**
 * The filters declared with `placement: "panel"` (and every filter a phone moves here), edited as a
 * draft in a sheet and applied in one go, so a change to six fields costs one request instead of six.
 * Desktop picks options with a `SelectField` and ranges with `NumberField`s; touch screens get chips for
 * a short option set and a drill-down row for a longer one, inside the same sheet. A list with saved views shows them first.
 */
const props = defineProps<{
  collection: Collection<Row>;
  filters: readonly FilterDescriptor[];
}>();

const emit = defineEmits<{ touched: [keys: string[]] }>();

const { t } = useI18n();

const sheet = useTemplateRef<InstanceType<typeof Sheet>>("sheet");
const isTouch = useMediaQuery("(max-width: 1023px), (pointer: coarse)");

const draft = ref<Record<string, string | null>>({});
/** range filters are edited as two inputs and joined back on apply. */
const rangeDraft = ref<Record<string, { min: string; max: string }>>({});
/** The filter whose options fill the sheet on touch screens (drill-down); null shows the list. */
const activeKey = ref<string | null>(null);
const activeFilter = computed(() => props.filters.find((filter) => filter.key === activeKey.value) ?? null);

function present() {
  const next: Record<string, string | null> = {};
  const ranges: Record<string, { min: string; max: string }> = {};
  for (const filter of props.filters) {
    const value = props.collection.query.value.filters[filter.key];
    next[filter.key] = isEmptyFilterValue(value) ? null : String(value);
    if (filter.type === "range") {
      const [from, until] = splitRange(next[filter.key]);
      ranges[filter.key] = { min: from ?? "", max: until ?? "" };
    }
  }
  draft.value = next;
  rangeDraft.value = ranges;
  activeKey.value = null;
  sheet.value?.present();
}

/** Changing a parent clears everything narrowed under it, recursively. */
function setValue(key: string, value: string | number | null | undefined) {
  const normalized = isEmptyFilterValue(value) ? null : String(value);
  if (draft.value[key] === normalized) return;
  draft.value = { ...draft.value, [key]: normalized };
  for (const child of props.filters.filter((filter) => filter.dependsOn === key)) setValue(child.key, null);
}

function reset() {
  for (const filter of props.filters) {
    draft.value[filter.key] = null;
    if (filter.type === "range") rangeDraft.value[filter.key] = { min: "", max: "" };
  }
}

const numeric = (text: string) => text.replace(/[^\d.,-]/g, "").replace(",", ".");
/** A range side is kept as text in the draft (it is joined back into "from,until"); its field edits it as a number. */
const rangeNumber = (key: string, side: "min" | "max"): number | null => {
  const text = rangeDraft.value[key]?.[side] ?? "";
  const value = text === "" ? Number.NaN : Number(numeric(text));
  return Number.isNaN(value) ? null : value;
};
function setRange(key: string, side: "min" | "max", value: number | null) {
  const range = rangeDraft.value[key];
  if (range) range[side] = value === null ? "" : String(value);
}

function draftValues(): Record<string, string | null> {
  const values: Record<string, string | null> = {};
  for (const filter of props.filters) {
    const range = rangeDraft.value[filter.key];
    values[filter.key] = filter.type === "range" ? joinRange(range ? numeric(range.min) : null, range ? numeric(range.max) : null) : (draft.value[filter.key] ?? null);
  }
  return values;
}

function apply() {
  const values = draftValues();
  const changed = Object.keys(values).filter((key) => (props.collection.query.value.filters[key] ?? null) !== values[key]);
  emit("touched", changed);
  props.collection.setFilters(values);
  sheet.value?.dismiss();
}

const optionsFor = (filter: FilterDescriptor) => narrowedOptions(filter, filter.dependsOn ? draft.value[filter.dependsOn] : null);
const allLabel = (filter: FilterDescriptor) => filter.defaultOptionTitle ?? t("core.collection.filters.show_all");

function valueLabel(filter: FilterDescriptor): string {
  const value = draft.value[filter.key];
  if (value === null || value === undefined) return allLabel(filter);
  return optionsFor(filter).find((option) => option.value === value)?.label ?? value;
}
/** What a touch list offers: "show all" (no value, no dot) and the options. */
const choicesFor = (filter: FilterDescriptor): { value: string | null; label: string; dot?: Tone }[] => [{ value: null, label: allLabel(filter) }, ...optionsFor(filter)];
/** The dot of the draft's option, for the touch row that shows it. */
const valueDot = (filter: FilterDescriptor) => {
  const value = draft.value[filter.key];
  return value === null || value === undefined ? undefined : optionsFor(filter).find((option) => option.value === value)?.dot;
};

/** The options of a select as a `SelectField` lists them: values as text (the draft's), with "show all" as the empty one. */
const selectOptions = (filter: FilterDescriptor) => [
  { value: "", label: allLabel(filter) },
  ...optionsFor(filter).map((option) => ({ value: String(option.value), label: option.label, dot: option.dot })),
];

const segmentTabs = (filter: FilterDescriptor) => [
  { value: "", label: allLabel(filter) },
  ...(filter.options ?? []).map((option) => ({ value: String(option.value), label: option.label })),
];

const CHIPS_MAX_OPTIONS = 8;
const CHIPS_MAX_LABEL = 18;
/** Chips when every option fits at a glance; a narrowed (dependsOn) list always drills down. */
function asChips(filter: FilterDescriptor): boolean {
  const options = optionsFor(filter);
  return !filter.dependsOn && options.length > 0 && options.length <= CHIPS_MAX_OPTIONS && options.every((option) => option.label.length <= CHIPS_MAX_LABEL);
}

const isDrilled = computed(() => isTouch.value && activeFilter.value !== null);

// --- saved views ---------------------------------------------------------------

const saved = computed(() => props.collection.savedViews);
const newName = ref("");
const saving = ref(false);
const savePopover = useTemplateRef<InstanceType<typeof Popover>>("savePopover");

/** What a save stores: the list's own other filters and search, and this draft of the panel's filters. */
function draftState() {
  const panelKeys = new Set(props.filters.map((filter) => filter.key));
  const filters: Record<string, string> = {};
  for (const [key, value] of Object.entries(props.collection.query.value.filters)) {
    if (!panelKeys.has(key) && value !== undefined && value !== "") filters[key] = String(value);
  }
  for (const [key, value] of Object.entries(draftValues())) if (value !== null) filters[key] = value;
  return { filters, search: props.collection.query.value.search };
}

const canSave = computed(() => {
  const state = draftState();
  return Object.keys(state.filters).length > 0 || state.search.trim() !== "";
});
const replacing = computed(() => {
  const name = newName.value.trim();
  return name ? (saved.value?.items.value.find((item) => item.name === name) ?? null) : null;
});

const failure = (error: unknown, fallback: string) => (isApiError(error) && error.message ? error.message : fallback);

async function saveCurrent() {
  const name = newName.value.trim();
  const views = saved.value;
  if (!views || !name || saving.value || !canSave.value) return;
  saving.value = true;
  try {
    const item = await views.save(name, draftState());
    newName.value = "";
    savePopover.value?.dismiss();
    toast.success(t("core.collection.saved.saved_toast", { name: item.name }));
    views.apply(item);
    emit("touched", []);
    sheet.value?.dismiss();
  } catch (error) {
    toast.error(failure(error, t("core.collection.saved.save_failed")));
  } finally {
    saving.value = false;
  }
}

function applySaved(item: SavedView) {
  saved.value?.apply(item);
  emit("touched", []);
  sheet.value?.dismiss();
}

const UNDO_MS = 6000;
/** Gone at once; the delete on the server waits for the toast to pass without Undo. */
function removeSaved(item: SavedView) {
  const views = saved.value;
  if (!views) return;
  const { revert, commit } = views.stageRemoval(item.id);
  const timer = setTimeout(() => {
    commit().catch((error: unknown) => {
      revert();
      toast.error(failure(error, t("core.collection.saved.delete_failed")));
    });
  }, UNDO_MS);
  toast.success(t("core.collection.saved.deleted_toast", { name: item.name }), {
    duration: UNDO_MS,
    action: {
      label: t("core.collection.saved.undo"),
      onClick: () => {
        clearTimeout(timer);
        revert();
      },
    },
  });
}

defineExpose({ present });
</script>

<template>
  <Sheet ref="sheet" :title="t('core.collection.filters.panel_title')" :grouped="isDrilled">
    <!-- Touch drill-down: one filter's options fill the sheet; back returns to the list. -->
    <div v-if="isTouch && activeFilter" data-test="filter-drilldown">
      <button type="button" data-test="filter-drilldown-back"
        class="-mx-2 -mt-2 mb-1 inline-flex h-10 cursor-pointer items-center gap-0.5 rounded-control px-2 text-body font-medium text-content-link active:bg-tint-soft"
        @click="activeKey = null">
        <Icon name="arrowLeftSLine" :size="20" />
        {{ t("core.collection.filters.panel_title") }}
      </button>
      <p class="mb-3 text-headline font-semibold">{{ activeFilter.label }}</p>
      <ul class="overflow-hidden rounded-group bg-surface-cell shadow-group" role="listbox" :aria-label="activeFilter.label">
        <li v-for="option in choicesFor(activeFilter)" :key="String(option.value)" role="presentation">
          <button type="button" role="option" :aria-selected="(draft[activeFilter.key] ?? null) === option.value"
            class="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 px-row-inset text-left text-body active:bg-fill"
            @click="setValue(activeFilter.key, option.value); activeKey = null">
            <span class="flex min-w-0 items-center gap-2"><ToneDot v-if="option.dot" :tone="option.dot" /><span class="min-w-0 truncate">{{ option.label }}</span></span>
            <Icon v-if="(draft[activeFilter.key] ?? null) === option.value" name="checkboxCircleFill" :size="18" class="shrink-0 text-content-link" />
          </button>
        </li>
      </ul>
    </div>

    <template v-else>
      <!-- Applying a saved view is the everyday action, so they lead the sheet; creating one lives behind "Save filters" in the footer. -->
      <section v-if="saved && saved.items.value.length > 0" class="mb-5 border-b border-border-separator pb-5" data-test="saved-filters">
        <p class="mb-2 text-footnote font-medium text-content-muted">{{ t("core.collection.saved.title") }}</p>
        <div class="flex flex-wrap gap-2">
          <span v-for="item in saved.items.value" :key="item.id" class="inline-flex h-8 items-center rounded-control bg-surface-cell text-subheadline shadow-group ring-1 ring-inset ring-border-separator">
            <button type="button" data-test="saved-filter-apply"
              class="inline-flex h-full cursor-pointer items-center gap-1.5 rounded-l-control pr-1.5 pl-2.5 font-medium text-content-strong hover:bg-fill"
              @click="applySaved(item)">
              <Icon name="starFill" :size="12" class="text-status-warning-content" />
              {{ item.name }}
            </button>
            <button type="button" data-test="saved-filter-delete" :aria-label="t('core.collection.saved.delete', { name: item.name })"
              :title="t('core.collection.saved.delete', { name: item.name })"
              class="h-full cursor-pointer rounded-r-control px-1.5 text-content-muted hover:bg-fill hover:text-content-destructive" @click="removeSaved(item)">
              <Icon name="close" :size="12" />
            </button>
          </span>
        </div>
      </section>

      <div class="space-y-5">
        <template v-for="filter in props.filters" :key="filter.key">
          <div v-if="filter.type === 'segmented'">
            <p class="mb-1.5 text-footnote font-medium text-content-muted">{{ filter.label }}</p>
            <Tabs :model-value="draft[filter.key] ?? ''" :tabs="segmentTabs(filter)" :label="filter.label" stretch
              @update:model-value="(value) => setValue(filter.key, value === null ? null : String(value))" />
          </div>

          <div v-else-if="filter.type === 'range'" role="group" :aria-label="filter.label">
            <p class="mb-1.5 text-footnote font-medium text-content-muted">{{ filter.label }}</p>
            <div v-if="rangeDraft[filter.key]" class="grid grid-cols-2 gap-3">
              <NumberField v-for="side in (['min', 'max'] as const)" :key="side" :model-value="rangeNumber(filter.key, side)" :name="`${filter.key}_${side}`" width="full" :decimals="filter.decimals ?? 0"
                :suffix="filter.unit" :label="t(side === 'min' ? 'core.collection.filters.range_from' : 'core.collection.filters.range_until')" @update:model-value="(value) => setRange(filter.key, side, value)" />
            </div>
          </div>

          <!-- Touch: chips for a short option set, a drill-down row otherwise. -->
          <div v-else-if="isTouch && asChips(filter)" role="group" :aria-label="filter.label" data-test="filter-chips">
            <p class="mb-2 text-footnote font-medium text-content-muted">{{ filter.label }}</p>
            <div class="flex flex-wrap gap-2">
              <button v-for="option in choicesFor(filter)" :key="String(option.value)" type="button"
                :aria-pressed="(draft[filter.key] ?? null) === option.value"
                class="min-h-9 cursor-pointer rounded-full px-3.5 text-subheadline ring-1 ring-inset transition-colors"
                :class="(draft[filter.key] ?? null) === option.value ? 'bg-tint-soft font-semibold text-content-link ring-border-selected' : 'bg-surface-cell text-content ring-border-separator active:bg-fill'"
                @click="setValue(filter.key, option.value)">
                <span class="inline-flex items-center gap-2"><ToneDot v-if="option.dot" :tone="option.dot" />{{ option.label }}</span>
              </button>
            </div>
          </div>

          <button v-else-if="isTouch" type="button" data-test="filter-row" :disabled="!!filter.dependsOn && optionsFor(filter).length === 0"
            class="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-group bg-surface-cell px-3 text-left ring-1 ring-inset ring-border-separator active:bg-fill disabled:cursor-not-allowed disabled:opacity-50"
            @click="activeKey = filter.key">
            <span class="shrink-0 text-subheadline font-medium">{{ filter.label }}</span>
            <span class="flex min-w-0 flex-1 items-center justify-end gap-2 text-subheadline" :class="draft[filter.key] == null ? 'text-content-disabled' : 'font-medium text-content-link'">
              <ToneDot v-if="valueDot(filter)" :tone="valueDot(filter)!" /><span class="truncate">{{ valueLabel(filter) }}</span>
            </span>
            <Icon name="arrowRightSLine" :size="18" class="shrink-0 text-content-muted" />
          </button>

          <SelectField v-else :model-value="draft[filter.key] ?? ''" :label="filter.label" :options="selectOptions(filter)" :disabled="!!filter.dependsOn && optionsFor(filter).length === 0"
            @update:model-value="(value) => setValue(filter.key, value === '' ? null : value)" />
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center justify-between gap-2">
        <Button prominence="standard" class="whitespace-nowrap" @click="reset">{{ t("core.collection.filters.reset_all") }}</Button>

        <div class="flex items-center gap-2">
          <Popover v-if="saved" ref="savePopover" placement="top-end" :label="t('core.collection.saved.save_button')">
            <template #trigger="{ toggle, attrs }">
              <span :title="canSave ? undefined : t('core.collection.saved.nothing_to_save')">
                <Button v-bind="{ ...attrs, 'data-test': 'saved-filter-open' }" prominence="standard" icon="save" class="whitespace-nowrap" :disabled="!canSave" @click="toggle">
                  <!-- Three footer buttons fit a phone only with the short label. -->
                  <span class="sm:hidden">{{ t("core.collection.saved.save") }}</span>
                  <span class="hidden sm:inline">{{ t("core.collection.saved.save_button") }}</span>
                </Button>
              </span>
            </template>
            <form class="flex flex-col gap-3" data-test="saved-filter-form" @submit.prevent="saveCurrent">
              <label class="flex flex-col gap-1.5 text-footnote font-medium text-content-muted">
                {{ t("core.collection.saved.name_label") }}
                <input v-model="newName" type="text" maxlength="60" autocomplete="off" :placeholder="t('core.collection.saved.name_placeholder')"
                  class="rounded-control bg-fill px-2.5 py-1.5 text-body text-content-strong outline-none placeholder:text-content-disabled focus:bg-surface-cell focus:ring-[1.5px] focus:ring-inset focus:ring-border-focus" />
              </label>
              <p v-if="replacing" class="text-footnote text-status-warning-content" data-test="saved-filter-replace-hint">
                {{ t("core.collection.saved.replace_hint", { name: replacing.name }) }}
              </p>
              <div class="flex justify-end gap-2">
                <Button size="sm" @click="savePopover?.dismiss()">{{ t("core.actions.cancel") }}</Button>
                <Button v-bind="{ 'data-test': 'saved-filter-save' }" type="submit" prominence="primary" size="sm" :processing="saving" :disabled="!newName.trim()">
                  {{ replacing ? t("core.collection.saved.replace") : t("core.collection.saved.save") }}
                </Button>
              </div>
            </form>
          </Popover>

          <Button prominence="primary" icon="filter3" class="whitespace-nowrap" @click="apply">{{ t("core.collection.filters.apply") }}</Button>
        </div>
      </div>
    </template>
  </Sheet>
</template>
