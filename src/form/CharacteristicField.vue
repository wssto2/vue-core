<script setup lang="ts" generic="Value extends string | number = number, Multiple extends boolean = false">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { characteristicsRoutes } from "../modules/characteristics/routes";
import { usePlatform } from "../platform";
import { fieldDefaults, fieldProps, type FieldProps } from "./field";
import MultiSelectField from "./MultiSelectField.vue";
import type { SelectOption } from "./options";
import SelectField from "./SelectField.vue";
import { useOptions, type AsyncOptions } from "./useOptions";

/**
 * A select over one branch of go-core's characteristics tree (`GET /v1/characteristics/options`): the active items below `parent` on `level`, in the
 * tree's order, in the language `lang`. It is a `SelectField` (or, with `multiple`, a `MultiSelectField`) that fetches its own options, so it
 * takes the same field props and `v-bind="form.bind('brand')"` as any other, and its loading and failed states are theirs: a spinner while the
 * options come, "Loading…" and "Try again" in the list.
 *
 *   <CharacteristicField v-bind="form.bind('make')" :label="t('make')" :level="2" :parent="brandsId" value="code" :lang="locale" />
 *   <CharacteristicField v-model="countries" :label="t('countries')" :level="3" :parent="countriesId" multiple />
 *
 * - **What is saved.** `value="id"` (the default) saves the item's id, a number; any other `value` names a column the project described
 *   (a brand's `additional_3` code) and saves that text. The model's type is the `Value` you pick.
 * - **Inactive items.** The server offers only active items, so an inactive item is not a choice. One that is already chosen still shows, marked
 *   "(inactive)" after its name, in the list and on the field: give it in `selected` (a record's saved option, as with `SelectField`), since the server cannot say
 *   what an inactive item is called. With `multiple` it disappears from the list once it is unticked.
 * - **Levels.** Below level 1 the branch is `parent`'s children: until `parent` is known (`null`) nothing is asked and the field is idle; when
 *   `parent` changes, a chosen value the new branch does not contain is cleared.
 * - `searchable` (default) puts a search box in the list.
 */
const props = withDefaults(defineProps<FieldProps & {
  /** The level of the items, from 1. */
  level: number;
  /** The id of the item the choices are children of; required below level 1. `null`: not chosen yet. */
  parent?: number | null;
  /** What a choice saves: `"id"` or the name of a described column. */
  value?: string;
  /** The language of the labels; default the first language the project lists. */
  lang?: string;
  /** Several choices: the model is a list. */
  multiple?: Multiple;
  /** Offers the search box (from the first option). */
  searchable?: boolean;
  placeholder?: string;
  /** The chosen options, when the caller has them (a saved record's labels): how an inactive item is named. */
  selected?: SelectOption<Value> | readonly SelectOption<Value>[] | null;
}>(), { ...fieldDefaults, parent: undefined, value: "id", lang: undefined, multiple: undefined, searchable: true, placeholder: undefined, selected: null });

/** One value (`null` for none), or with `multiple` a list of them: the type follows `multiple`, so `form.bind()` fits either. */
const model = defineModel<Multiple extends true ? Value[] : Value | null>({ default: null as never });

const { t } = useI18n();
const { http } = usePlatform();
const byId = computed(() => props.value === "id");

const loaded = useOptions<{ level: number; parent: number | null; value: string; lang: string | undefined }, Value>({
  // Below level 1 nothing is asked until the branch is known.
  for: () => (props.level > 1 && (props.parent === null || props.parent === undefined) ? null : { level: props.level, parent: props.parent ?? null, value: props.value, lang: props.lang }),
  load: async (input, { signal }) => {
    const { data } = await http.request(characteristicsRoutes.options, { level: input.level, ...(input.parent === null ? {} : { parent: input.parent }), ...(input.value === "id" ? {} : { value: input.value }), ...(input.lang ? { lang: input.lang } : {}) }, { signal });
    return data.map((option) => ({ value: (byId.value ? Number(option.value) : option.value) as Value, label: option.label }));
  },
});

const chosen = computed<readonly Value[]>(() => (Array.isArray(model.value) ? (model.value as Value[]) : model.value === null || model.value === undefined ? [] : [model.value as Value]));
const known = computed<readonly SelectOption<Value>[]>(() => (props.selected === null ? [] : Array.isArray(props.selected) ? (props.selected as readonly SelectOption<Value>[]) : [props.selected as SelectOption<Value>]));

// The loaded options, plus the chosen ones the server no longer offers (inactive), marked; only once the load landed, or all would look inactive.
const options: AsyncOptions<Value> = {
  get status() { return loaded.status; },
  get generation() { return loaded.generation; },
  reload: () => loaded.reload(),
  get options() {
    if (loaded.status !== "loaded") return loaded.options;
    const offered = new Set(loaded.options.map((option) => option.value));
    const inactive = known.value.filter((option) => chosen.value.includes(option.value) && !offered.has(option.value)).map((option): SelectOption<Value> => ({ ...option, label: t("core.characteristics.field.inactive", { label: option.label }), dot: "neutral" }));
    return [...loaded.options, ...inactive];
  },
};
const searchFrom = computed(() => (props.searchable ? 1 : Number.MAX_SAFE_INTEGER));
const selectedForSingle = computed(() => known.value.find((option) => option.value === model.value) ?? null);
</script>

<template>
  <MultiSelectField v-if="props.multiple" v-bind="fieldProps(props)" v-model="(model as Value[])" :options="options" :selected="known" :placeholder="props.placeholder" :search-from="searchFrom" />
  <SelectField v-else v-bind="fieldProps(props)" v-model="model as Value | null" :options="options" :selected="selectedForSingle" :placeholder="props.placeholder" :search-from="searchFrom" />
</template>
