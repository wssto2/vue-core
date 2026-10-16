import type { PluralizationRule } from "vue-i18n";

/**
 * Plural rules for the Slavic locales the library ships, ready for `pluralRules` of `createApplication`
 * (or of `createI18n`). vue-i18n picks the form of `t("key", { count })` by the index a rule returns
 * for the number of forms the message has, so the message is written in the order of its layout:
 *
 * | forms | layout                            | hr, bs, sr-Latn                  | sl                            |
 * |-------|-----------------------------------|----------------------------------|-------------------------------|
 * | 2     | one \| other                      | 1, 21, 101 … / the rest          | 1, 101 … / the rest           |
 * | 3     | none \| one \| other              | 0 / 1, 21 … / the rest           | the same                      |
 * | 4     | none \| one \| few \| other       | + 2-4, 22-24 … (not 12-14)       | + 2-4, 102-104 … (two is few) |
 * | 5     | none \| one \| two \| few \| other | as 4 (no dual: two is few)       | + 2, 102 … / 3-4, 103 …       |
 *
 *   "{count} osoba | {count} osoba | {count} osobe | {count} osoba"   // hr: none | one | few | other
 *   createApplication({ pluralRules: slavicPluralRules, … })
 */
export type PluralCategory = "none" | "one" | "two" | "few" | "other";

// Whole numbers only (CLDR gives fractions their own rules; a fractional count takes the `other` form).
function category(count: number, locale: "slavic" | "slovenian"): PluralCategory {
  const n = Math.abs(count);
  if (n === 0) return "none";
  if (!Number.isInteger(n)) return "other";
  if (locale === "slovenian") {
    const last = n % 100;
    if (last === 1) return "one";
    if (last === 2) return "two";
    return last === 3 || last === 4 ? "few" : "other";
  }
  // Croatian, Bosnian, Serbian: the teens (11-14, also in 111-114 …) are never "one" or "few".
  const last = n % 10;
  const teen = n % 100 >= 11 && n % 100 <= 14;
  if (teen) return "other";
  if (last === 1) return "one";
  return last >= 2 && last <= 4 ? "few" : "other";
}

function indexOf(kind: PluralCategory, forms: number, locale: "slavic" | "slovenian"): number {
  if (forms <= 2) return kind === "one" ? 0 : 1;
  // With a dual form (sl, five forms) two is its own; without one it is a few.
  const dual = locale === "slovenian" && forms >= 5;
  const layout: PluralCategory[] = forms === 3 ? ["none", "one", "other"] : dual ? ["none", "one", "two", "few", "other"] : ["none", "one", "few", "other"];
  const wanted = kind === "two" && !dual ? "few" : kind;
  // Three forms have no "few": it is the rest.
  const index = layout.indexOf(wanted === "few" && forms === 3 ? "other" : wanted);
  return index < 0 ? layout.length - 1 : index;
}

/** Croatian, Bosnian and Serbian: one (1, 21, 101 …), few (2-4, 22-24 …), other (5-20, 25 …; 111-114 …). */
export const slavicPluralRule: PluralizationRule = (count, forms) => indexOf(category(count, "slavic"), forms, "slavic");

/** Slovenian: one (1, 101 …), two (2, 102 …), few (3-4, 103-104 …), other (5-100 …); without a dual form two is few. */
export const slovenianPluralRule: PluralizationRule = (count, forms) => indexOf(category(count, "slovenian"), forms, "slovenian");

/** The rules of every locale the library ships a Slavic language for, by vue-i18n locale code. */
export const slavicPluralRules: Readonly<Record<"hr" | "bs" | "sr-Latn" | "sl", PluralizationRule>> = {
  hr: slavicPluralRule,
  bs: slavicPluralRule,
  "sr-Latn": slavicPluralRule,
  sl: slovenianPluralRule,
};
