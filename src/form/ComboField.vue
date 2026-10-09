<script setup lang="ts" generic="Value extends string | number">
import { computed, shallowRef, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Icon } from "../icon";
import { controlWidth, type ControlWidth } from "../controls";
import { useControlSurface } from "./control";
import Field from "./Field.vue";
import { fieldDefaults, fieldProps, useFormGroup, type FieldProps, type FieldSlots } from "./field";
import type { SelectOption } from "./options";
import SuggestionList from "./SuggestionList.vue";
import { listShows, useSuggestions } from "./suggestions";

/**
 * A choice found by typing: a customer, a vehicle, a user. The options are either a fixed list filtered as the user
 * types (`options`), or searched on the server (`search`, from the feature's `api.ts`: the field does no HTTP itself).
 *
 *   <ComboField v-bind="form.bind('customerId')" :label="t('customer')" :search="(query, { signal }) => api.customers(query, { signal })" :selected="customerOption" />
 *
 * Only the latest search lands (an answer for older text, or after a pick, is dropped, and its request aborted); searches
 * wait `debounce` ms after the last key. A saved value's label cannot be searched by id: pass the record's own option as
 * `selected`, or the field shows nothing for it. Leaving the field without picking puts the chosen label back; clearing
 * the text clears the value. Keys: Down and Up move, Enter picks, Escape closes (without closing a dialog around it).
 * `recents="customer"` lists the last picks under "Recent" before anything is typed (kept per id, see `recentChoicesKey`).
 * The same engine suggests free text in `TextField :suggestions`.
 */
const props = withDefaults(
  defineProps<FieldProps & {
    /** A fixed list, filtered locally. */
    options?: readonly SelectOption<Value>[];
    /** Searches the server; the answer for the text typed. */
    search?: (query: string, context: { signal: AbortSignal }) => Promise<readonly SelectOption<Value>[]>;
    /** The option of the current value when the caller already has it (a saved record's customer). */
    selected?: SelectOption<Value> | null;
    placeholder?: string;
    /** The fewest characters before `search` is asked. */
    minLength?: number;
    /** Milliseconds to wait after the last key before a server search. */
    debounce?: number;
    /** The most options shown. */
    limit?: number;
    /** The id the last picks are kept under; setting it turns "Recent" on. */
    recents?: string;
    width?: Exclude<ControlWidth, "content">;
  }>(),
  { ...fieldDefaults, options: undefined, search: undefined, selected: null, placeholder: undefined, minLength: 1, debounce: 300, limit: 30, recents: undefined, width: "md" },
);

const model = defineModel<Value | null>({ default: null });
const emit = defineEmits<{ picked: [option: SelectOption<Value>] }>();

const { t } = useI18n();
const inRow = !!useFormGroup();
const surface = useControlSurface("text", () => (props.error ? "error" : props.disabled ? "locked" : "rest"));
const fieldWidth = computed(() => (inRow ? controlWidth(props.width) : "w-full"));
const input = useTemplateRef<HTMLInputElement>("input");
const anchor = useTemplateRef<HTMLElement>("anchor");

const picked = shallowRef<SelectOption<Value> | null>(null);
const text = shallowRef("");
const suggestions = useSuggestions<Value>({
  source: () => props.search ?? props.options,
  minLength: () => props.minLength,
  debounce: () => props.debounce,
  limit: () => props.limit,
  listAllWhenEmpty: true,
  recents: () => props.recents,
});
const { items, open, status, highlighted, showingRecent } = suggestions;

const current = computed(() => {
  const value = model.value;
  if (value === null) return null;
  return [picked.value, props.selected, ...(props.options ?? [])].find((option) => option?.value === value) ?? null;
});
watch(current, (option) => {
  if (!open.value) text.value = option?.label ?? "";
}, { immediate: true });

function onInput(event: Event) {
  text.value = (event.target as HTMLInputElement).value;
  suggestions.ask(text.value);
  if (text.value === "") {
    model.value = null;
    picked.value = null;
  }
}

function onFocus() {
  if (!props.disabled) suggestions.show("");
}

function choose(option: SelectOption<Value>) {
  suggestions.close();
  suggestions.remember(option);
  picked.value = option;
  model.value = option.value;
  text.value = option.label;
  emit("picked", option);
}

function onBlur() {
  // What was typed but not picked is not a choice: the chosen label comes back.
  suggestions.close();
  text.value = current.value?.label ?? "";
}

const expanded = computed(() => listShows(open.value, items.value.length, status.value, true));
defineExpose({ focus: () => input.value?.focus() });
defineSlots<FieldSlots>();
</script>

<template>
  <Field v-bind="fieldProps(props)" :value="current?.label ?? null">
    <template #default="{ id, describedby, invalid }">
      <div ref="anchor" class="flex items-center gap-1.5" :class="[surface, fieldWidth]">
        <input :id="id" ref="input" role="combobox" type="text" autocomplete="off" :value="text" :name="props.name" :placeholder="props.placeholder" :disabled="props.disabled" :required="props.required"
          aria-autocomplete="list" :aria-expanded="expanded" :aria-controls="`${id}-list`" :aria-activedescendant="expanded && items.length > 0 ? `${id}-option-${highlighted}` : undefined" :aria-required="props.required || undefined"
          :aria-invalid="invalid || undefined" :aria-describedby="describedby"
          class="block w-full min-w-0 border-0 bg-transparent px-0 py-1 text-body text-content-strong placeholder:text-content-disabled focus:outline-none focus:ring-0 disabled:cursor-not-allowed" :class="inRow ? 'compact:text-right' : ''"
          @input="onInput" @focus="onFocus" @blur="onBlur" @keydown="suggestions.keydown($event, { pick: choose, enterNeedsMove: false })" />
        <Icon name="search" :size="14" class="shrink-0 text-content-muted" />
      </div>

      <SuggestionList :id="id" :anchor="anchor" :open="open" :items="items" :highlighted="highlighted" :query="text" :status="status" :recent="showingRecent" :empty-message="true"
        :hint="t('core.form.suggestions.keys_pick')" @pick="choose" @hover="suggestions.highlight($event)" />
    </template>
    <template v-if="$slots.trailing" #trailing><slot name="trailing" /></template>
    <template v-if="$slots.labelTrailing" #labelTrailing><slot name="labelTrailing" /></template>
    <template v-if="$slots.readonly" #readonly><slot name="readonly" /></template>
  </Field>
</template>
