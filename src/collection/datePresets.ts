import { useI18n } from "vue-i18n";
import type { FilterDescriptor } from "./filters";

/** The presets go-core's date helper understands (`utils.DateRange`). */
export const DATE_PRESETS = ["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "this_year", "last_year"] as const;

/**
 * A filter over a date column with go-core's presets (today, this week, last month...), its labels
 * translated. Call it once while a component is set up (it uses `useI18n`, which exists only then),
 * and use the result in the `filters` computed: calling it inside the computed throws when the
 * computed runs again, and options that load later never appear.
 *
 *   const created = useDatePresetFilter("created_at");
 *   const filters = computed(() => [created, …]);
 */
export function useDatePresetFilter<Filter extends string>(key: Filter, label?: string): FilterDescriptor<Filter> {
  const { t } = useI18n();
  return {
    key,
    icon: "calendarEventFill",
    label: label ?? t("core.collection.date_presets.label"),
    type: "select",
    options: DATE_PRESETS.map((preset) => ({ value: preset, label: t(`core.collection.date_presets.options.${preset}`) })),
  };
}
