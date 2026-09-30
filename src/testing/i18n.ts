import { createI18n } from "vue-i18n";
import { coreMessages, type CoreLocale } from "../i18n";

/** A vue-i18n instance with the library's messages, for tests and the playground. Not public. */
export function createTestI18n(locale: CoreLocale = "en") {
  return createI18n({ legacy: false, locale, fallbackLocale: "en", messages: coreMessages });
}
