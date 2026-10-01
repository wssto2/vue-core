/** What `I18nField` edits: the text in each language, by locale (`{ hr: "Naslov", en: "Title" }`). An empty string is "not written yet". */
export type I18nText = Record<string, string>;

/** The required languages that have no text yet. Use it in the form's validator: the field says it on screen, the validator stops the save. */
export function missingLocales(value: Readonly<Record<string, string | undefined>> | null | undefined, required: readonly string[]): readonly string[] {
  return required.filter((locale) => (value?.[locale] ?? "").trim() === "");
}
