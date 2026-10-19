import { describe, expect, it } from "vitest";
import { createFormatting } from "./format";

// ARV's frontend/utils/locale.ts (formatDate) is the spec: Chromium has no Bosnian data, `bs` reads `sr-Latn-BA`, which writes
// Serbian jun/jul/avgust; the Bosnian names replace the month word (nominative alone, genitive with a day, short = 3 letters).
const NOMINATIVE = ["januar", "februar", "mart", "april", "maj", "juni", "juli", "august", "septembar", "oktobar", "novembar", "decembar"];
const GENITIVE = ["januara", "februara", "marta", "aprila", "maja", "juna", "jula", "augusta", "septembra", "oktobra", "novembra", "decembra"];
const bs = createFormatting({ locale: () => "bs" });

describe("a date with Intl options in Bosnian", () => {
  const months = [...Array(12).keys()];
  it.each(months)("month %i: long and short, with and without a day", (month) => {
    const date = new Date(2026, month, 7);
    expect(bs.date(date, { month: "long" })).toBe(NOMINATIVE[month]);
    expect(bs.date(date, { month: "long", year: "numeric" })).toBe(`${NOMINATIVE[month]} 2026.`);
    expect(bs.date(date, { day: "numeric", month: "long" })).toBe(`7. ${GENITIVE[month]}`);
    expect(bs.date(date, { day: "numeric", month: "long", year: "numeric" })).toBe(`7. ${GENITIVE[month]} 2026.`);
    expect(bs.date(date, { month: "short" })).toBe(NOMINATIVE[month]!.slice(0, 3));
    expect(bs.date(date, { day: "numeric", month: "short" })).toBe(`7. ${NOMINATIVE[month]!.slice(0, 3)}`);
  });

  it("keeps the weekday and the rest of the sentence", () => {
    expect(bs.date(new Date(2026, 9, 7), { weekday: "long", day: "numeric", month: "long", year: "numeric" })).toBe("srijeda, 7. oktobra 2026.");
  });

  it("leaves a numeric month and other languages to Intl", () => {
    expect(bs.date(new Date(2026, 5, 7), { day: "numeric", month: "numeric" })).toBe("7. 6.");
    const hr = createFormatting({ locale: () => "hr" });
    expect(hr.date(new Date(2026, 9, 7), { day: "numeric", month: "long", year: "numeric" })).toBe("7. listopada 2026.");
  });

  it("is nothing for a value that is no date", () => {
    expect(bs.date("garbage", { month: "long" })).toBe("");
  });
});
