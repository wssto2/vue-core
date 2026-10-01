import { computed, type ComputedRef } from "vue";
import { useI18n } from "vue-i18n";
import { isDayDisabled, today, type DayRules } from "./days";
import { defaultQuickPicks, resolveQuickPick, type QuickPick, type Shortcut } from "./quickPicks";

/** The day shortcuts of a field, with the wording of the app's language; a day the field does not allow is disabled. */
export function useDayShortcuts(picks: () => readonly QuickPick[] | undefined, compact: () => boolean, rules: () => DayRules): ComputedRef<(Shortcut & { disabled: boolean })[]> {
  const { t } = useI18n();
  return computed(() => {
    const now = today();
    return (picks() ?? defaultQuickPicks(compact())).map((pick) => {
      const shortcut = resolveQuickPick(pick, (name) => t(`core.form.date.${name.replace(/-/g, "_")}`), now);
      return { ...shortcut, disabled: isDayDisabled(shortcut.value, rules()) };
    });
  });
}
