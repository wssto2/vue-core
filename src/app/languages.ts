import { computed, type ComputedRef } from "vue";
import type { SelectOption } from "../form";
import { languageName } from "../internal/languageName";
import { useApplication } from "./environment";

/**
 * The languages the application offers (`createApplication({ locale: { supported } })`), as the options of a select, each named in itself.
 *
 *   const languages = useLanguages();   // <Select v-model="locale" :options="languages" />
 */
export function useLanguages(): ComputedRef<readonly SelectOption<string>[]> {
  const application = useApplication();
  return computed(() => application.locales.map((code) => ({ value: code, label: languageName(code) })));
}
