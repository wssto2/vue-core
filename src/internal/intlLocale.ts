// Chromium ships no Bosnian `Intl` data and falls back to English while still reporting `bs`; Bosnian written in Latin script with
// Bosnia's conventions is `sr-Latn-BA` (same separators, month names and `KM`). Every other locale is passed through unchanged.
// Add a row here only when a second locale has the same gap.
const INTL_LOCALE: Readonly<Record<string, string>> = { bs: "sr-Latn-BA" };

/** The locale to give `Intl` for the app's active one. Not for a language's own name: `DisplayNames` knows `bs` ("bosanski"). */
export const intlLocale = (locale: string): string => INTL_LOCALE[locale] ?? locale;
