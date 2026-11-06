<script setup lang="ts">
import { computed, useSlots } from "vue";
import { useI18n } from "vue-i18n";
import type { RouteLocationRaw } from "vue-router";
import type { IconName } from "../icon";
import type { PageAction } from "../page";
import { thumbnailUrl } from "../form/dynamic/resources";
import type { FormSchema } from "../form/dynamic/schema";
import CollectionPage from "./CollectionPage.vue";
import type { Column, CollectionColumns, RowAction } from "./columns";
import { useDatePresetFilter } from "./datePresets";
import { defineCollection } from "./definition";
import { isFilterable, isSortable, listedFields, optionsOf, textOf } from "./dynamicColumns";
import type { FilterDescriptor } from "./filters";
import type { CollectionLoader, CollectionStateSource } from "./types";
import { useCollection } from "./useCollection";

type Row = Record<string, unknown>;

/**
 * A list page generated from a typed schema: a column per listable field, sort on the fields the backend can order by, and a
 * filter per select, boolean and date field, all from the same schema. It is `defineCollection` + `useCollection` +
 * `CollectionPage` with `Row = Record<string, unknown>`; the loader is yours (it receives the query with those sort and filter keys).
 *
 *   <DynamicCollection id="content.news" :schema="schema" :load="api.entries" title="News" :record-route="(row) => `/news/${row.id}`" thumbnail="/media/{id}/thumb" />
 *
 * Cells: text, number, date and datetime as the standard kinds; boolean as a yes / no badge; select as a badge with the option's label;
 * translated text in the current language; image as a picture from `thumbnail`. The first text field (or `titleField`) is the
 * record's name and links to it. A `#cell-<key>` slot replaces any cell. The schema is read once, when the page is set up: key the
 * component by the type to show another.
 *
 * Filters: a select offers its options, a boolean "yes" / "no" (the values `"true"` and `"false"`), a date the date presets.
 */
const props = withDefaults(defineProps<{
  schema: FormSchema;
  /** The list's identity (saved views and logs use it). */
  id: string;
  load: CollectionLoader<Row, string, string, string>;
  title: string;
  description?: string;
  icon?: IconName;
  actions?: readonly PageAction[];
  /** Where a row's record lives. */
  recordRoute?: (row: Row) => RouteLocationRaw;
  rowActions?: (row: Row) => RowAction[];
  /** Default: the URL's query under `q`. */
  state?: CollectionStateSource;
  /** The field that names the record and links to it. Default: the first text field. */
  titleField?: string;
  /** The columns to show, in order. Default: every listable field of the schema. */
  columns?: readonly string[];
  /** A URL with `{id}` for the pictures of image fields. */
  thumbnail?: string;
  /** The language of translated text. Default: the interface's. */
  locale?: string;
}>(), {
  description: undefined,
  icon: undefined,
  actions: () => [],
  recordRoute: undefined,
  rowActions: undefined,
  state: () => ({ kind: "url", key: "q" }),
  titleField: undefined,
  columns: undefined,
  thumbnail: undefined,
  locale: undefined,
});

const { t, locale: uiLocale } = useI18n();
const language = computed(() => props.locale ?? uiLocale.value);
const fields = listedFields(props.schema, props.columns);
const titleKey = props.titleField ?? fields.find((field) => field.kind === "text")?.key;
const labels = computed(() => ({ yes: t("core.form.yes"), no: t("core.form.no") }));

const definition = defineCollection<Row, string, string, string>({
  id: props.id,
  stateVersion: 1,
  load: props.load,
  key: (row) => row.id as string | number,
  query: { sorts: fields.filter(isSortable).map((field) => field.key), filters: fields.filter(isFilterable).map((field) => field.key) },
});

const dates = new Map(fields.filter((field) => field.kind === "date" || field.kind === "datetime").map((field) => [field.key, useDatePresetFilter(field.key, field.label)]));
const filters = computed<FilterDescriptor[]>(() => fields.filter(isFilterable).map((field) => dates.get(field.key)?.value ?? { key: field.key, label: field.label, type: "select", options: optionsOf(field, labels.value) }));

const optionLabel = (field: (typeof fields)[number], value: unknown): string => field.options?.find((option) => option.value === value)?.label ?? String(value ?? "");
const tableColumns = computed<CollectionColumns<Row>>(() => fields.map((field): Column<Row> => {
  const common = { key: field.key, label: field.label, ...(isSortable(field) ? { sort: field.key } : {}) };
  if (field.key === titleKey) return { ...common, kind: "identity", title: (row) => textOf(row[field.key], language.value) };
  switch (field.kind) {
    case "number":
      return { ...common, kind: "number" };
    case "date":
      return { ...common, kind: "timestamp", precision: "date" };
    case "datetime":
      return { ...common, kind: "timestamp", precision: "dateTime" };
    case "boolean":
      return { ...common, kind: "badge", tone: (row) => (row[field.key] === true ? "positive" : "neutral"), text: (row) => (row[field.key] === true ? labels.value.yes : labels.value.no) };
    case "select":
      return { ...common, kind: "badge", tone: () => "neutral", text: (row) => optionLabel(field, row[field.key]) };
    case "text":
      return field.translatable ? { ...common, kind: "custom" } : { ...common, kind: "text" };
    default:
      return { ...common, kind: "custom" };
  }
}));

const collection = useCollection(definition, {
  columns: tableColumns,
  filters,
  state: props.state,
  ...(props.recordRoute ? { recordRoute: props.recordRoute } : {}),
});

// Cells the standard kinds cannot draw. Vue reads a dot in a static slot name as a modifier, so `a.b` is `cell-a_b` (the same rule as `SlotKey`).
const slotName = (key: string) => `cell-${key.replace(/\./g, "_")}`;
const slots = useSlots();
const own = computed(() => tableColumns.value.filter((column) => column.kind === "custom" && !(slotName(column.key) in slots)));
const forwarded = () => Object.keys(slots);
const fieldOf = (key: string) => fields.find((field) => field.key === key)!;
const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
</script>

<template>
  <CollectionPage :collection="collection" :title="props.title" :description="props.description" :icon="props.icon" :actions="props.actions" :row-actions="props.rowActions">
    <template v-for="name in forwarded()" :key="name" #[name]="scope">
      <!-- @vue-ignore -->
      <slot :name="name" v-bind="(scope as Record<string, unknown> | undefined) ?? {}" />
    </template>
    <template v-for="column in own" :key="column.key" #[slotName(column.key)]="{ item }: { item: Row }">
      <template v-for="field in [fieldOf(column.key)]" :key="field.key">
        <span v-if="field.kind === 'text'">{{ textOf(item[field.key], language) }}</span>
        <img v-else-if="field.kind === 'image' && props.thumbnail && item[field.key] != null" :src="thumbnailUrl({ thumbnail: props.thumbnail }, item[field.key] as string | number)" alt="" class="size-10 rounded object-cover" loading="lazy" />
        <span v-else-if="field.kind === 'gallery'">{{ listOf(item[field.key]).length || "" }}</span>
        <span v-else-if="field.kind === 'multi_select'">{{ listOf(item[field.key]).map((value) => optionLabel(field, value)).join(", ") }}</span>
        <span v-else>{{ item[field.key] ?? "" }}</span>
      </template>
    </template>
  </CollectionPage>
</template>
