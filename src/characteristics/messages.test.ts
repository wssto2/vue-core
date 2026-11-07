import { describe, expect, it } from "vitest";
import { createI18n } from "vue-i18n";
import { coreMessages, slavicPluralRules } from "../i18n";

// The plural texts of this screen in the languages that have more than one plural: what the person reads for 1, 2 and 5.
function words(locale: "hr" | "bs" | "sr-Latn" | "sl", key: string, counts: number[]) {
  const i18n = createI18n({ legacy: false, locale, messages: coreMessages as never, pluralRules: slavicPluralRules });
  return counts.map((count) => i18n.global.t(key, { count }, count));
}

describe("the characteristics texts' plurals", () => {
  it("Croatian: razina / razine / razina and stavku / stavke / stavki", () => {
    expect(words("hr", "core.characteristics.levels", [1, 2, 5, 21])).toEqual(["1 razina", "2 razine", "5 razina", "21 razina"]);
    expect(words("hr", "core.characteristics.delete_dialog.children", [1, 3, 11])).toEqual(["Ima 1 stavku ispod sebe.", "Ima 3 stavke ispod sebe.", "Ima 11 stavki ispod sebe."]);
    expect(words("hr", "core.explorer.selected", [0, 1, 5])).toEqual(["Ništa nije odabrano", "1 odabrano", "5 odabrano"]);
  });

  it("Bosnian and Serbian: nivo / nivoa", () => {
    expect(words("bs", "core.characteristics.levels", [1, 2, 5])).toEqual(["1 nivo", "2 nivoa", "5 nivoa"]);
    expect(words("sr-Latn", "core.characteristics.levels", [1, 3])).toEqual(["1 nivo", "3 nivoa"]);
  });

  it("Slovenian has a dual: raven / ravni, element / elementa / elementi / elementov", () => {
    expect(words("sl", "core.characteristics.levels", [1, 2, 3, 5])).toEqual(["1 raven", "2 ravni", "3 ravni", "5 ravni"]);
    expect(words("sl", "core.characteristics.delete_dialog.children", [1, 2, 3, 5])).toEqual(["Pod njo je 1 element.", "Pod njo sta 2 elementa.", "Pod njo so 3 elementi.", "Pod njo je 5 elementov."]);
  });
});
