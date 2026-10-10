<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { controlWidth, type ControlWidth } from "../controls";
import { useControlSurface } from "./control";
import Field from "./Field.vue";
import { fieldDefaults, fieldProps, useFormGroup, type FieldProps, type FieldSlots } from "./field";
import type { SelectOption } from "./options";
import SuggestionList from "./SuggestionList.vue";
import { completionOf, listShows, useSuggestions, type SuggestionSource, type TextSuggestion } from "./suggestions";

/**
 * A line of text: a name, an e-mail address, a code. The value is always a string ("" is empty); a nullable
 * column is mapped to and from "" where the record is mapped (`toValues`, the payload), not guessed here.
 *
 *   <TextField v-bind="form.bind('email')" type="email" :label="t('email')" required />
 *   <TextField v-bind="form.bind('vin')" mono suffix="VIN" :label="t('vin')" />
 *
 * `mono` is for codes read character by character (0 and O, 1 and l); `prefix` and `suffix` are plain text
 * (a unit, an @) inside the control; `width` is the filled control's width in a row on wide screens. The `#prefix` slot
 * puts an icon or image before the value, editing and reading (a flag before a translation).
 *
 * `suggestions` offers texts while typing, from a list or from the server (`api.ts` does the request); the value stays a
 * string whatever is picked. The best match shows grey after the typed text and Tab accepts it; the list marks the matched
 * part, Down / Up move, Enter picks a row moved to, Escape closes. `recents="city"` lists the last picks before typing.
 *
 *   <TextField v-bind="form.bind('city')" :suggestions="(query, { signal }) => api.cities(query, signal)" recents="city" :label="t('city')" />
 */
const props = withDefaults(
  defineProps<FieldProps & {
    type?: "text" | "email" | "tel" | "url" | "password" | "search";
    placeholder?: string;
    maxLength?: number;
    autocomplete?: string;
    mono?: boolean;
    prefix?: string;
    suffix?: string;
    /** sm 10rem · md 18rem (default) · lg 22rem · full (to the row's edge). */
    width?: Exclude<ControlWidth, "content">;
    /** Texts offered while typing: a list filtered as the user types, or a function that asks the server for the text typed (the older request is aborted). */
    suggestions?: readonly TextSuggestion[] | ((query: string, context: { signal: AbortSignal }) => Promise<readonly TextSuggestion[]>);
    /** The fewest characters before a function is asked. */
    suggestionsMinLength?: number;
    /** Milliseconds to wait after the last key before a function is asked. */
    suggestionsDebounce?: number;
    /** The most suggestions shown. */
    suggestionsLimit?: number;
    /** The id the last picks are kept under (see `recentChoicesKey`); setting it shows them under "Recent" before typing. */
    recents?: string;
  }>(),
  {
    ...fieldDefaults, type: "text", placeholder: undefined, maxLength: undefined, autocomplete: undefined, mono: false, prefix: undefined, suffix: undefined, width: "md",
    suggestions: undefined, suggestionsMinLength: 2, suggestionsDebounce: 300, suggestionsLimit: 8, recents: undefined,
  },
);

const model = defineModel<string>({ default: "" });
const emit = defineEmits<{ picked: [suggestion: { text: string; detail?: string }]; focus: [event: FocusEvent]; blur: [event: FocusEvent] }>();
const input = useTemplateRef<HTMLInputElement>("input");
const anchor = useTemplateRef<HTMLElement>("anchor");
const inRow = !!useFormGroup();
const surface = useControlSurface("text", () => (props.error ? "error" : props.disabled ? "locked" : "rest"));
const fieldWidth = computed(() => (inRow ? controlWidth(props.width) : "w-full"));

const { t } = useI18n();
const asOption = (item: TextSuggestion): SelectOption<string> => (typeof item === "string" ? { value: item, label: item } : { value: item.text, label: item.text, ...(item.detail !== undefined ? { description: item.detail } : {}) });
const source = computed<SuggestionSource<string> | undefined>(() => {
  const given = props.suggestions;
  if (!given) return undefined;
  if (typeof given === "function") return async (query, context) => (await given(query, context)).map(asOption);
  return given.map(asOption);
});
const suggesting = computed(() => source.value !== undefined);
const engine = useSuggestions<string>({
  source: () => source.value,
  minLength: () => props.suggestionsMinLength,
  debounce: () => props.suggestionsDebounce,
  limit: () => props.suggestionsLimit,
  listAllWhenEmpty: false,
  recents: () => props.recents,
});
const { items, open, status, highlighted, showingRecent } = engine;
const caretAtEnd = ref(true);
const noteCaret = () => {
  const element = input.value;
  caretAtEnd.value = !element || (element.selectionStart === element.value.length && element.selectionEnd === element.value.length);
};
/** What the best match adds after the typed text, shown grey: only while the caret is at the end of what was typed. */
const completion = computed(() => (suggesting.value && open.value && !showingRecent.value && caretAtEnd.value && engine.current.value ? completionOf(model.value, engine.current.value.label) : ""));
const expanded = computed(() => listShows(open.value, items.value.length, status.value, false));

function onInput(event: Event) {
  noteCaret();
  if (suggesting.value) engine.ask((event.target as HTMLInputElement).value);
}
function pick(option: SelectOption<string>) {
  model.value = option.value;
  engine.remember(option);
  engine.close();
  emit("picked", { text: option.value, ...(option.description !== undefined ? { detail: option.description } : {}) });
}
/** Focusing a field that has text suggests nothing (that would search for what is already there); an empty one shows the recent picks. */
function onFocus(event: FocusEvent) {
  emit("focus", event);
  if (suggesting.value && model.value === "") engine.show("");
}
function onBlur(event: FocusEvent) {
  engine.close();
  emit("blur", event);
}
function acceptCompletion(): boolean {
  const option = engine.current.value;
  if (!completion.value || !option) return false;
  pick(option);
  return true;
}
const onKeydown = (event: KeyboardEvent) => {
  if (suggesting.value) engine.keydown(event, { pick, enterNeedsMove: true, complete: acceptCompletion });
};

defineExpose({ focus: () => input.value?.focus() });
defineSlots<FieldSlots & {
  /** An icon or image before the value, in the control and in the read-mode row (a country's flag before its translation). Give an image `alt=""` when the label already says what it shows. */
  prefix?: () => unknown;
}>();
</script>

<template>
  <Field v-bind="fieldProps(props)" :value="model" :prefix="props.prefix" :suffix="props.suffix" :value-style="props.mono ? 'mono' : undefined">
    <template #default="{ id, describedby, invalid }">
      <div ref="anchor" class="flex items-center gap-1.5" :class="[surface, fieldWidth]">
        <span v-if="$slots.prefix" class="flex shrink-0 items-center" data-test="field-prefix"><slot name="prefix" /></span>
        <span v-if="props.prefix" class="shrink-0 text-footnote text-content-muted">{{ props.prefix }}</span>
        <div class="relative min-w-0 flex-1">
          <input :id="id" ref="input" v-model="model" :type="props.type" :name="props.name" :placeholder="props.placeholder" :maxlength="props.maxLength" :autocomplete="suggesting ? 'off' : props.autocomplete"
            :disabled="props.disabled" :required="props.required" :aria-required="props.required || undefined" :aria-invalid="invalid || undefined" :aria-describedby="describedby"
            :role="suggesting ? 'combobox' : undefined" :aria-autocomplete="suggesting ? 'both' : undefined" :aria-expanded="suggesting ? expanded : undefined" :aria-controls="suggesting ? `${id}-list` : undefined"
            :aria-activedescendant="suggesting && expanded && items.length > 0 ? `${id}-option-${highlighted}` : undefined"
            class="block w-full min-w-0 border-0 bg-transparent px-0 py-1 text-body text-content-strong placeholder:text-content-disabled focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
            :class="[props.mono ? 'font-mono' : '', inRow && !suggesting ? 'compact:text-right' : '']"
            @input="onInput" @keyup="noteCaret" @click="noteCaret" @keydown="onKeydown" @focus="onFocus" @blur="onBlur" />
          <!-- The grey completion: the typed text takes its room invisibly, the rest shows after it. -->
          <span v-if="completion" aria-hidden="true" class="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre py-1 text-body" :class="props.mono ? 'font-mono' : ''" data-test="completion">
            <span class="invisible">{{ model }}</span><span class="text-content-disabled">{{ completion }}</span>
          </span>
        </div>
        <span v-if="props.suffix" class="shrink-0 text-footnote text-content-muted">{{ props.suffix }}</span>
      </div>
      <SuggestionList v-if="suggesting" :id="id" :anchor="anchor" :open="open" :items="items" :highlighted="highlighted" :query="model" :status="status" :recent="showingRecent" :empty-message="false"
        :hint="completion ? t('core.form.suggestions.keys_complete') : t('core.form.suggestions.keys_pick')" @pick="pick" @hover="engine.highlight($event)" />
    </template>
    <template v-if="$slots.prefix" #prefix><slot name="prefix" /></template>
    <template v-if="$slots.trailing" #trailing><slot name="trailing" /></template>
    <template v-if="$slots.labelTrailing" #labelTrailing><slot name="labelTrailing" /></template>
    <template v-if="$slots.readonly" #readonly><slot name="readonly" /></template>
  </Field>
</template>
