import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { defaultQuickTimes, resolveQuickTime, type QuickTime, type Shortcut } from "./quickPicks";
import { parseTimeText, timeNow, type Time } from "./time";

/** What a field that takes typed times needs: reading them (`1435`, `14.35`, the word for now), the messages and the shortcuts. */
export function useTimeText(step: () => number) {
  const { t } = useI18n();
  const nowWords = computed(() => [t("core.form.time.words.now").toLowerCase(), "now"]);

  return {
    placeholder: computed(() => t("core.form.time.placeholder")),
    parse(text: string): { value: Time } | { error: string } {
      if (nowWords.value.includes(text.trim().toLowerCase())) return { value: timeNow(step()) };
      const result = parseTimeText(text, step());
      if ("time" in result) return { value: result.time };
      return { error: result.error === "step" ? t("core.form.time.step", { step: step() }) : t("core.form.time.invalid") };
    },
    shortcuts: (picks: readonly QuickTime[] | undefined): Shortcut[] => (picks ?? defaultQuickTimes).map((pick) => resolveQuickTime(pick, t("core.form.time.now"), timeNow(step()))),
  };
}
