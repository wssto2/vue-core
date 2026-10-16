import { describe, expect, it } from "vitest";
import { createI18n } from "vue-i18n";
import { slavicPluralRule, slavicPluralRules, slovenianPluralRule } from "./plural";

// The form each count takes, by the layout of the message.
const forms = (rule: typeof slavicPluralRule, layout: number, counts: number[]) => counts.map((count) => rule(count, layout));

describe("Croatian, Bosnian and Serbian", () => {
  it("picks none, one, few and other with four forms (none | one | few | other)", () => {
    const form = (n: number) => slavicPluralRule(n, 4);
    expect([0].map(form)).toEqual([0]);
    expect([1, 21, 31, 101, 1001].map(form)).toEqual([1, 1, 1, 1, 1]);
    expect([2, 3, 4, 22, 23, 24, 102, 104].map(form)).toEqual([2, 2, 2, 2, 2, 2, 2, 2]);
    expect([5, 9, 10, 11, 12, 13, 14, 15, 19, 20, 25, 100].map(form)).toEqual(Array(12).fill(3));
  });

  it("keeps the teens of the hundreds in the other form (111 is not one, 112 is not few)", () => {
    expect(forms(slavicPluralRule, 4, [111, 112, 113, 114, 211, 1011])).toEqual([3, 3, 3, 3, 3, 3]);
    expect(forms(slavicPluralRule, 4, [121, 122, 115])).toEqual([1, 2, 3]);
  });

  it("with three forms (none | one | other) has no few, and with two (one | other) no none", () => {
    expect(forms(slavicPluralRule, 3, [0, 1, 2, 4, 5, 21, 22, 11])).toEqual([0, 1, 2, 2, 2, 1, 2, 2]);
    expect(forms(slavicPluralRule, 2, [0, 1, 2, 21, 22, 11])).toEqual([1, 0, 1, 0, 1, 1]);
  });

  it("treats a negative count like its absolute value and a fraction as other", () => {
    expect(slavicPluralRule(-1, 4)).toBe(1);
    expect(slavicPluralRule(-3, 4)).toBe(2);
    expect(slavicPluralRule(1.5, 4)).toBe(3);
    expect(slavicPluralRule(2.5, 3)).toBe(2);
  });
});

describe("Slovenian", () => {
  it("picks none, one, two, few and other with five forms", () => {
    const form = (n: number) => slovenianPluralRule(n, 5);
    expect(form(0)).toBe(0);
    expect([1, 101, 201, 1001].map(form)).toEqual([1, 1, 1, 1]);
    expect([2, 102, 202].map(form)).toEqual([2, 2, 2]);
    expect([3, 4, 103, 104].map(form)).toEqual([3, 3, 3, 3]);
    expect([5, 11, 12, 21, 22, 23, 24, 100, 111, 112].map(form)).toEqual(Array(10).fill(4));
  });

  it("is not Croatian: 21 is other, 101 is one, 102 is two", () => {
    expect(slovenianPluralRule(21, 5)).toBe(4);
    expect(slavicPluralRule(21, 4)).toBe(1);
    expect(slovenianPluralRule(101, 4)).toBe(1);
  });

  it("without a dual form two takes the few form (four forms) or the rest (three)", () => {
    expect(forms(slovenianPluralRule, 4, [0, 1, 2, 3, 4, 5, 102])).toEqual([0, 1, 2, 2, 2, 3, 2]);
    expect(forms(slovenianPluralRule, 3, [0, 1, 2, 3, 5])).toEqual([0, 1, 2, 2, 2]);
    expect(forms(slovenianPluralRule, 2, [1, 101, 2, 0])).toEqual([0, 0, 1, 1]);
  });
});

describe("slavicPluralRules in vue-i18n", () => {
  const i18n = createI18n({
    legacy: false,
    locale: "hr",
    pluralRules: slavicPluralRules,
    messages: {
      hr: { people: "nitko | {count} osoba | {count} osobe | {count} osoba" },
      "sr-Latn": { people: "niko | {count} osoba | {count} osobe | {count} osoba" },
      bs: { people: "niko | {count} osoba | {count} osobe | {count} osoba" },
      sl: { people: "nobenega | {count} oseba | {count} osebi | {count} osebe | {count} oseb" },
    },
  });
  const say = (locale: "hr" | "bs" | "sr-Latn" | "sl", count: number) => {
    i18n.global.locale.value = locale;
    return i18n.global.t("people", { count }, { plural: count });
  };

  it("says Croatian, Bosnian and Serbian counts", () => {
    expect([0, 1, 2, 5, 11, 21, 22, 111].map((n) => say("hr", n))).toEqual(["nitko", "1 osoba", "2 osobe", "5 osoba", "11 osoba", "21 osoba", "22 osobe", "111 osoba"]);
    expect(say("bs", 3)).toBe("3 osobe");
    expect(say("sr-Latn", 24)).toBe("24 osobe");
  });

  it("says Slovenian counts with the dual", () => {
    expect([0, 1, 2, 3, 4, 5, 101, 102, 103].map((n) => say("sl", n))).toEqual(["nobenega", "1 oseba", "2 osebi", "3 osebe", "4 osebe", "5 oseb", "101 oseba", "102 osebi", "103 osebe"]);
  });
});
