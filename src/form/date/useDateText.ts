import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useFormat } from "../../format";
import { isDayDisabled, today, type Day, type DayRules } from "./days";
import { detectOrder, parseDayText, shortExample } from "./parse";

/**
 * What a field that takes typed dates needs to read them in the language and the format of the app: the order of day, month
 * and year (read off the app's formatter), the words for today and tomorrow, the messages and the placeholder.
 */
export function useDateText(rules: () => DayRules) {
  const { t } = useI18n();
  const format = useFormat();
  const write = (day: Day) => format.date(day);

  const order = computed(() => detectOrder(write));
  const words = computed(() => ({
    today: [t("core.form.date.words.today").toLowerCase(), "today"],
    tomorrow: [t("core.form.date.words.tomorrow").toLowerCase(), "tomorrow"],
    yesterday: [t("core.form.date.words.yesterday").toLowerCase(), "yesterday"],
  }));
  const placeholder = computed(() => t("core.form.date.placeholder", { example: shortExample(write, order.value, today()) }));

  return {
    placeholder,
    /** The day a text means, or null. */
    parse: (text: string): Day | null => parseDayText(text, { order: order.value, words: words.value }),
    available: (day: Day) => !isDayDisabled(day, rules()),
    invalidMessage: () => t("core.form.date.invalid", { example: write(today()) }),
    unavailableMessage: () => t("core.form.date.unavailable"),
  };
}
