import bs from "./bs.json";
import en from "./en.json";
import hr from "./hr.json";
import sl from "./sl.json";

/**
 * The library's own UI texts, under the `core` namespace, for every supported locale. An app
 * merges them into its vue-i18n messages (`i18n.global.mergeLocaleMessage(locale, coreMessages[locale])`)
 * and may override any key afterwards.
 */
export const coreMessages = { en, hr, bs, sl } as const;

export type CoreLocale = keyof typeof coreMessages;
/** The shape of one locale's messages: `{ core: { … } }`. */
export type CoreMessages = typeof en;
