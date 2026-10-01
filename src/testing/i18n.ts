import { createI18n } from "vue-i18n";
import { coreMessages } from "../i18n";

/** Messages per locale: `{ en: { tickets: { title: "Tickets" } } }`. */
export type TestMessages = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

export interface TestI18nOptions {
  /** Default `en`. */
  locale?: string;
  /** Your texts, merged over the library's (`core.*`) per locale; a key you give wins. */
  messages?: TestMessages;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function merge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const out = { ...target };
  for (const [key, value] of Object.entries(source)) {
    const current = out[key];
    out[key] = isObject(value) && isObject(current) ? merge(current, value) : value;
  }
  return out;
}

/**
 * A vue-i18n instance (composition API) with the library's messages in every locale it ships and
 * yours merged on top, so a component under test says what it says in production.
 *
 *   const i18n = createTestI18n({ messages: { en: { tickets: { title: "Tickets" } } } });
 */
export function createTestI18n(options: TestI18nOptions = {}) {
  const messages: Record<string, Record<string, unknown>> = { ...coreMessages };
  for (const [locale, own] of Object.entries(options.messages ?? {})) messages[locale] = merge(messages[locale] ?? {}, own);
  return createI18n({ legacy: false, locale: options.locale ?? "en", fallbackLocale: "en", messages: messages as unknown as typeof coreMessages }); // typed as the library's, so `global.locale` is the composition API's ref
}
