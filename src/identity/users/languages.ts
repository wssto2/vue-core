import { computed, type ComputedRef } from "vue";
import { useApplication } from "../../app";
import type { SelectOption } from "../../form";
import { languageName } from "../../internal/languageName";

/** The languages the application offers, as the options of a select (each named in itself). */
export function useLanguages(): ComputedRef<readonly SelectOption<string>[]> {
  const application = useApplication();
  return computed(() => application.locales.map((code) => ({ value: code, label: languageName(code) })));
}
