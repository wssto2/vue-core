import { describe, expect, it } from "vitest";
import bs from "../i18n/bs.json";
import en from "../i18n/en.json";
import hr from "../i18n/hr.json";
import sl from "../i18n/sl.json";
import srLatn from "../i18n/sr-Latn.json";
import { createFormatting, type FormattingOptions } from "./format";

// The spec for the options an application sets to write dates and numbers its own way. The expected strings are what ARV's
// frontend/utils/helpers.ts (formatDate, formatDateTime, formatTime, formatDay, formatDayTime, formatNumber, numberFormatters)
// printed for the same inputs, taken from a run of those helpers under TZ=UTC and Europe/Zagreb (identical); none of ARV's code is here.
// ARV names its languages hr, en, si, ba, rs; the library's codes for them are hr, en, sl, bs, sr-Latn.
const LANGUAGES = [["hr", "hr"], ["en", "en"], ["si", "sl"], ["ba", "bs"], ["rs", "sr-Latn"]] as const;
const MESSAGES: Record<string, unknown> = { hr, en, sl, bs, "sr-Latn": srLatn };

const arv = {
  intlLocale: { en: "en-GB", sl: "sl-SI", bs: "sr-Latn-BA", "sr-Latn": "sr-Latn-RS" },
  datePattern: { hr: "DD.MM.YYYY.", en: "DD/MM/YYYY", sl: "DD.MM.YYYY", bs: "DD.MM.YYYY.", "sr-Latn": "DD.MM.YYYY." },
  numberSymbols: { group: ".", decimal: "," },
  emptyNumber: "0",
} satisfies Partial<FormattingOptions>;

const formatFor = (code: string) =>
  createFormatting({
    locale: () => code,
    ...arv,
    translate: (key) => String(key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], MESSAGES[code]) ?? key),
  });

const now = new Date(2026, 8, 30, 12, 0);
const at = (days: number, hours: number, minutes = 0) => new Date(2026, 8, 30 + days, hours, minutes).toISOString();
const dateInputs: Record<string, string | null> = {
  null: null,
  empty: "",
  zero0000: "0000-00-00",
  zero0000dt: "0000-00-00 00:00:00",
  zero0001Z: "0001-01-01T00:00:00Z",
  zero1970Z: "1970-01-01T00:00:00Z",
  garbage: "garbage",
  civil: "2026-09-30",
  spaceMin: "2026-09-30 14:05",
  spaceSec: "2026-09-30 14:05:33",
  localT: "2026-09-30T14:05:00",
  isoZ: at(0, 14, 5),
  midnightSpace: "2026-09-30 00:00",
  midnightT: "2026-09-30T00:00:00",
  lastMinute: "2026-12-31 23:59",
  newYear: "2026-01-01 00:00",
  todayMorning: at(0, 9, 12),
  yesterdayEve: at(-1, 21, 5),
  twoDaysAgo: at(-2, 8, 0),
  tomorrow: at(1, 11, 0),
};
type Cell = string | readonly string[];
const DATES: Record<string, Partial<Record<"date" | "dateTime" | "time" | "day" | "daySentence" | "dayTime", Cell>>> = {
  null: { date: "", dateTime: "", time: "", day: "", daySentence: "", dayTime: "" },
  empty: { date: "", dateTime: "", time: "", day: "", daySentence: "", dayTime: "" },
  zero0000: { date: "", dateTime: "", time: "", day: "", daySentence: "", dayTime: "" },
  zero0000dt: { date: "", dateTime: "", time: "", day: "", daySentence: "", dayTime: "" },
  zero0001Z: { date: "", dateTime: "", time: "", day: "", daySentence: "", dayTime: "" },
  zero1970Z: { date: "", dateTime: "", time: "", day: "", daySentence: "", dayTime: "" },
  garbage: { date: "", dateTime: "", time: "", day: "", daySentence: "", dayTime: "" },
  civil: { date: ["30.09.2026.", "30/09/2026", "30.09.2026", "30.09.2026.", "30.09.2026."], day: ["Danas", "Today", "Danes", "Danas", "Danas"], daySentence: ["danas", "today", "danes", "danas", "danas"] },
  spaceMin: { date: ["30.09.2026.", "30/09/2026", "30.09.2026", "30.09.2026.", "30.09.2026."], dateTime: ["30.09.2026. 14:05", "30/09/2026 14:05", "30.09.2026 14:05", "30.09.2026. 14:05", "30.09.2026. 14:05"], time: "14:05", day: ["Danas", "Today", "Danes", "Danas", "Danas"], daySentence: ["danas", "today", "danes", "danas", "danas"], dayTime: ["Danas · 14:05", "Today · 14:05", "Danes · 14:05", "Danas · 14:05", "Danas · 14:05"] },
  spaceSec: { date: ["30.09.2026.", "30/09/2026", "30.09.2026", "30.09.2026.", "30.09.2026."], dateTime: ["30.09.2026. 14:05", "30/09/2026 14:05", "30.09.2026 14:05", "30.09.2026. 14:05", "30.09.2026. 14:05"], time: "14:05", day: ["Danas", "Today", "Danes", "Danas", "Danas"], daySentence: ["danas", "today", "danes", "danas", "danas"], dayTime: ["Danas · 14:05", "Today · 14:05", "Danes · 14:05", "Danas · 14:05", "Danas · 14:05"] },
  localT: { date: ["30.09.2026.", "30/09/2026", "30.09.2026", "30.09.2026.", "30.09.2026."], dateTime: ["30.09.2026. 14:05", "30/09/2026 14:05", "30.09.2026 14:05", "30.09.2026. 14:05", "30.09.2026. 14:05"], time: "14:05", day: ["Danas", "Today", "Danes", "Danas", "Danas"], daySentence: ["danas", "today", "danes", "danas", "danas"], dayTime: ["Danas · 14:05", "Today · 14:05", "Danes · 14:05", "Danas · 14:05", "Danas · 14:05"] },
  isoZ: { date: ["30.09.2026.", "30/09/2026", "30.09.2026", "30.09.2026.", "30.09.2026."], dateTime: ["30.09.2026. 14:05", "30/09/2026 14:05", "30.09.2026 14:05", "30.09.2026. 14:05", "30.09.2026. 14:05"], time: "14:05", day: ["Danas", "Today", "Danes", "Danas", "Danas"], daySentence: ["danas", "today", "danes", "danas", "danas"], dayTime: ["Danas · 14:05", "Today · 14:05", "Danes · 14:05", "Danas · 14:05", "Danas · 14:05"] },
  midnightSpace: { date: ["30.09.2026.", "30/09/2026", "30.09.2026", "30.09.2026.", "30.09.2026."], dateTime: ["30.09.2026. 00:00", "30/09/2026 00:00", "30.09.2026 00:00", "30.09.2026. 00:00", "30.09.2026. 00:00"], time: "00:00", day: ["Danas", "Today", "Danes", "Danas", "Danas"], daySentence: ["danas", "today", "danes", "danas", "danas"], dayTime: ["Danas · 00:00", "Today · 00:00", "Danes · 00:00", "Danas · 00:00", "Danas · 00:00"] },
  midnightT: { date: ["30.09.2026.", "30/09/2026", "30.09.2026", "30.09.2026.", "30.09.2026."], dateTime: ["30.09.2026. 00:00", "30/09/2026 00:00", "30.09.2026 00:00", "30.09.2026. 00:00", "30.09.2026. 00:00"], time: "00:00", day: ["Danas", "Today", "Danes", "Danas", "Danas"], daySentence: ["danas", "today", "danes", "danas", "danas"], dayTime: ["Danas · 00:00", "Today · 00:00", "Danes · 00:00", "Danas · 00:00", "Danas · 00:00"] },
  lastMinute: { date: ["31.12.2026.", "31/12/2026", "31.12.2026", "31.12.2026.", "31.12.2026."], dateTime: ["31.12.2026. 23:59", "31/12/2026 23:59", "31.12.2026 23:59", "31.12.2026. 23:59", "31.12.2026. 23:59"], time: "23:59", day: ["31.12.2026.", "31/12/2026", "31.12.2026", "31.12.2026.", "31.12.2026."], daySentence: ["31.12.2026.", "31/12/2026", "31.12.2026", "31.12.2026.", "31.12.2026."], dayTime: ["31.12.2026. · 23:59", "31/12/2026 · 23:59", "31.12.2026 · 23:59", "31.12.2026. · 23:59", "31.12.2026. · 23:59"] },
  newYear: { date: ["01.01.2026.", "01/01/2026", "01.01.2026", "01.01.2026.", "01.01.2026."], dateTime: ["01.01.2026. 00:00", "01/01/2026 00:00", "01.01.2026 00:00", "01.01.2026. 00:00", "01.01.2026. 00:00"], time: "00:00", day: ["01.01.2026.", "01/01/2026", "01.01.2026", "01.01.2026.", "01.01.2026."], daySentence: ["01.01.2026.", "01/01/2026", "01.01.2026", "01.01.2026.", "01.01.2026."], dayTime: ["01.01.2026. · 00:00", "01/01/2026 · 00:00", "01.01.2026 · 00:00", "01.01.2026. · 00:00", "01.01.2026. · 00:00"] },
  todayMorning: { date: ["30.09.2026.", "30/09/2026", "30.09.2026", "30.09.2026.", "30.09.2026."], dateTime: ["30.09.2026. 09:12", "30/09/2026 09:12", "30.09.2026 09:12", "30.09.2026. 09:12", "30.09.2026. 09:12"], time: "09:12", day: ["Danas", "Today", "Danes", "Danas", "Danas"], daySentence: ["danas", "today", "danes", "danas", "danas"], dayTime: ["Danas · 09:12", "Today · 09:12", "Danes · 09:12", "Danas · 09:12", "Danas · 09:12"] },
  yesterdayEve: { date: ["29.09.2026.", "29/09/2026", "29.09.2026", "29.09.2026.", "29.09.2026."], dateTime: ["29.09.2026. 21:05", "29/09/2026 21:05", "29.09.2026 21:05", "29.09.2026. 21:05", "29.09.2026. 21:05"], time: "21:05", day: ["Jučer", "Yesterday", "Včeraj", "Jučer", "Juče"], daySentence: ["jučer", "yesterday", "včeraj", "jučer", "juče"], dayTime: ["Jučer · 21:05", "Yesterday · 21:05", "Včeraj · 21:05", "Jučer · 21:05", "Juče · 21:05"] },
  twoDaysAgo: { date: ["28.09.2026.", "28/09/2026", "28.09.2026", "28.09.2026.", "28.09.2026."], dateTime: ["28.09.2026. 08:00", "28/09/2026 08:00", "28.09.2026 08:00", "28.09.2026. 08:00", "28.09.2026. 08:00"], time: "08:00", day: ["28.09.2026.", "28/09/2026", "28.09.2026", "28.09.2026.", "28.09.2026."], daySentence: ["28.09.2026.", "28/09/2026", "28.09.2026", "28.09.2026.", "28.09.2026."], dayTime: ["28.09.2026. · 08:00", "28/09/2026 · 08:00", "28.09.2026 · 08:00", "28.09.2026. · 08:00", "28.09.2026. · 08:00"] },
  tomorrow: { date: ["01.10.2026.", "01/10/2026", "01.10.2026", "01.10.2026.", "01.10.2026."], dateTime: ["01.10.2026. 11:00", "01/10/2026 11:00", "01.10.2026 11:00", "01.10.2026. 11:00", "01.10.2026. 11:00"], time: "11:00", day: ["01.10.2026.", "01/10/2026", "01.10.2026", "01.10.2026.", "01.10.2026."], daySentence: ["01.10.2026.", "01/10/2026", "01.10.2026", "01.10.2026.", "01.10.2026."], dayTime: ["01.10.2026. · 11:00", "01/10/2026 · 11:00", "01.10.2026 · 11:00", "01.10.2026. · 11:00", "01.10.2026. · 11:00"] },};

const numberInputs: Record<string, number | null | undefined> = {
  null: null, undef: undefined, NaN: NaN, zero: 0, one: 1, neg1: -1, n999: 999, n1000: 1000, n1234: 1234, n1234_5: 1234.5, n1234_5678: 1234.5678,
  n1_005: 1.005, n0_5: 0.5, n2_5: 2.5, neg1234_5: -1234.5, neg0_4: -0.4, n1234567_891: 1234567.891, big: 123456789012.345, n71000: 71000,
  n0_1p0_2: 0.1 + 0.2, n1_255: 1.255, n8_345: 8.345, n39600: 39600, n19500: 19500,
};
const NUMBERS: Record<string, Partial<Record<"n0" | "n2" | "lib" | "noGroup1" | "noGroup" | "eur" | "eur0", Cell>>> = {
  null: { n0: "0", n2: "0", lib: "0" },
  undef: { n0: "0", n2: "0", lib: "0" },
  NaN: { n0: "0", n2: "0", lib: "0" },
  zero: { n0: "0", n2: "0,00", lib: "0", noGroup1: "0,0", noGroup: "0", eur: "0,00 €", eur0: "0 €" },
  one: { n0: "1", n2: "1,00", lib: "1", noGroup1: "1,0", noGroup: "1", eur: "1,00 €", eur0: "1 €" },
  neg1: { n0: "-1", n2: "-1,00", lib: "-1", noGroup1: "-1,0", noGroup: "-1", eur: "-1,00 €", eur0: "-1 €" },
  n999: { n0: "999", n2: "999,00", lib: "999", noGroup1: "999,0", noGroup: "999", eur: "999,00 €", eur0: "999 €" },
  n1000: { n0: "1.000", n2: "1.000,00", lib: "1.000", noGroup1: "1000,0", noGroup: "1000", eur: "1.000,00 €", eur0: "1.000 €" },
  n1234: { n0: "1.234", n2: "1.234,00", lib: "1.234", noGroup1: "1234,0", noGroup: "1234", eur: "1.234,00 €", eur0: "1.234 €" },
  n1234_5: { n0: "1.235", n2: "1.234,50", lib: "1.234,5", noGroup1: "1234,5", noGroup: "1234,5", eur: "1.234,50 €", eur0: "1.235 €" },
  n1234_5678: { n0: "1.235", n2: "1.234,57", lib: "1.234,568", noGroup1: "1234,6", noGroup: "1234,568", eur: "1.234,57 €", eur0: "1.235 €" },
  n1_005: { n0: "1", n2: "1,00", lib: "1,005", noGroup1: "1,0", noGroup: "1,005", eur: "1,00 €", eur0: "1 €" },
  n0_5: { n0: "1", n2: "0,50", lib: "0,5", noGroup1: "0,5", noGroup: "0,5", eur: "0,50 €", eur0: "1 €" },
  n2_5: { n0: "3", n2: "2,50", lib: "2,5", noGroup1: "2,5", noGroup: "2,5", eur: "2,50 €", eur0: "3 €" },
  neg1234_5: { n0: "-1.235", n2: "-1.234,50", lib: "-1.234,5", noGroup1: "-1234,5", noGroup: "-1234,5", eur: "-1.234,50 €", eur0: "-1.235 €" },
  neg0_4: { n0: "-0", n2: "-0,40", lib: "-0,4", noGroup1: "-0,4", noGroup: "-0,4", eur: "-0,40 €", eur0: "-0 €" },
  n1234567_891: { n0: "1.234.568", n2: "1.234.567,89", lib: "1.234.567,891", noGroup1: "1234567,9", noGroup: "1234567,891", eur: "1.234.567,89 €", eur0: "1.234.568 €" },
  big: { n0: "123.456.789.012", n2: "123.456.789.012,35", lib: "123.456.789.012,345", noGroup1: "123456789012,3", noGroup: "123456789012,345", eur: "123.456.789.012,35 €", eur0: "123.456.789.012 €" },
  n71000: { n0: "71.000", n2: "71.000,00", lib: "71.000", noGroup1: "71000,0", noGroup: "71000", eur: "71.000,00 €", eur0: "71.000 €" },
  n0_1p0_2: { n0: "0", n2: "0,30", lib: "0,3", noGroup1: "0,3", noGroup: "0,3", eur: "0,30 €", eur0: "0 €" },
  n1_255: { n0: "1", n2: "1,25", lib: "1,255", noGroup1: "1,3", noGroup: "1,255", eur: "1,25 €", eur0: "1 €" },
  n8_345: { n0: "8", n2: "8,35", lib: "8,345", noGroup1: "8,3", noGroup: "8,345", eur: "8,35 €", eur0: "8 €" },
  n39600: { n0: "39.600", n2: "39.600,00", lib: "39.600", noGroup1: "39600,0", noGroup: "39600", eur: "39.600,00 €", eur0: "39.600 €" },
  n19500: { n0: "19.500", n2: "19.500,00", lib: "19.500", noGroup1: "19500,0", noGroup: "19500", eur: "19.500,00 €", eur0: "19.500 €" },};

const cell = (value: Cell, index: number) => (typeof value === "string" ? value : value[index]!);

describe("the options ARV sets write what ARV's helpers wrote", () => {
  LANGUAGES.forEach(([arvCode, code], index) => {
    describe(arvCode, () => {
      const format = formatFor(code);

      it.each(Object.entries(DATES))("date and time of %s", (label, expected) => {
        const input = dateInputs[label];
        const actual = {
          date: format.date(input),
          dateTime: format.dateTime(input),
          time: format.time(input),
          day: format.day(input, { now }),
          daySentence: format.day(input, { now, inSentence: true }),
          dayTime: format.dayTime(input, { now }),
        };
        for (const [field, want] of Object.entries(expected)) expect(actual[field as keyof typeof actual], field).toBe(cell(want, index));
      });

      it.each(Object.entries(NUMBERS))("number %s", (label, expected) => {
        const value = numberInputs[label];
        const digits = (n: number) => ({ minimumFractionDigits: n, maximumFractionDigits: n });
        const actual = {
          n0: format.number(value, digits(0)),
          n2: format.number(value, digits(2)),
          lib: format.number(value),
          noGroup1: format.number(value, { ...digits(1), useGrouping: false }),
          noGroup: format.number(value, { useGrouping: false }),
          eur: format.money(value, { currency: "EUR" }),
          eur0: format.money(value, { currency: "EUR", decimals: 0 }),
        };
        for (const [field, want] of Object.entries(expected)) expect(actual[field as keyof typeof actual], field).toBe(cell(want, index));
      });
    });
  });
});
