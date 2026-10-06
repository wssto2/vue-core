import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from "vue";
import { useI18n } from "vue-i18n";
import type { FilterDescriptor } from "./filters";

/** The presets go-core's date helper understands (`utils.DateRange`). */
export const DATE_PRESETS = ["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "this_year", "last_year"] as const;

/**
 * A filter over a date column with go-core's presets (today, this week, last month...), its labels
 * translated. Call it once while a component is set up (it takes `t` from `useI18n`, which exists
 * only then) and use the result in the `filters` computed: the descriptor's labels follow the locale,
 * so changing the language while the list is open re-labels it. `label` may be a getter, which
 * follows the locale too.
 *
 *   const created = useDatePresetFilter("created_at");
 *   const filters = computed(() => [created.value, …]);
 */
export function useDatePresetFilter<Filter extends string>(key: Filter, label?: MaybeRefOrGetter<string>): ComputedRef<FilterDescriptor<Filter>> {
  const { t } = useI18n();
  return computed(() => ({
    key,
    icon: "calendarEventFill",
    label: toValue(label) ?? t("core.collection.date_presets.label"),
    type: "select",
    options: DATE_PRESETS.map((preset) => ({ value: preset, label: t(`core.collection.date_presets.options.${preset}`) })),
  }));
}
