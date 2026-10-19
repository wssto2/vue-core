import type { App } from "vue";
import { defineFeatureContext } from "../platform/context";
import { intlLocale } from "../internal/intlLocale";

/** What the formatting functions accept for a point in time. Anything that is not a real date reads as "nothing to show". */
export type DateInput = Date | string | number | null | undefined;

// A date without a time ("2026-09-30") is a calendar day, not an instant: read as UTC midnight it
// would show the day before in zones west of Greenwich, so it is that day in the local zone.
const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
// "2026-09-30 14:05[:33]" is how MySQL and the forms write a time of day; Safari's `new Date` rejects the space, so it is read as local time with a "T".
const SPACED_DATE_TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/;
// What an unset date looks like on the wire: MySQL's zero date, Go's zero time, the epoch.
const ZERO_DATES = ["0000-00-00", "0001-01-01", "1970-01-01"];

/**
 * Normalizes a value to a `Date`, or null when there is nothing to show: no value, one that is not a
 * date, or an unset one (a string that starts with a zero date, `0000-00-00`, `0001-01-01` or `1970-01-01`, in any
 * form; a Date or a number at or before the epoch): none of them is a date anybody meant.
 * Reads `YYYY-MM-DD HH:mm[:ss]` (space-separated) as local time, and a civil `YYYY-MM-DD` as that day at local midnight.
 */
export function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  let date: Date;
  if (value instanceof Date) date = value;
  else if (typeof value === "number") date = new Date(value);
  else {
    if (ZERO_DATES.some((zero) => value.startsWith(zero))) return null;
    const civil = CIVIL_DATE.exec(value);
    if (civil) date = new Date(Number(civil[1]), Number(civil[2]) - 1, Number(civil[3]));
    else date = new Date(SPACED_DATE_TIME.test(value) ? value.replace(" ", "T") : value);
  }
  return Number.isNaN(date.getTime()) || date.getTime() <= 0 ? null : date;
}

/**
 * The formatting of one application, one function per kind of value. Every function receives a value
 * that is already valid (a real `Date`, a finite number) and the active locale, and returns the text.
 * An application replaces any of them (ARV shows `DD.MM.YYYY.`); the rest keep the `Intl` defaults.
 */
export interface Formatters {
  date(value: Date, locale: string): string;
  dateTime(value: Date, locale: string): string;
  time(value: Date, locale: string): string;
  number(value: number, locale: string, options?: Intl.NumberFormatOptions): string;
  /** `options` carries the fraction digits when the caller asked for them; ignoring it is allowed. */
  money(amount: number, currency: string, locale: string, options?: Intl.NumberFormatOptions): string;
  /** `now` is the moment to count from. */
  relative(value: Date, locale: string, now: Date): string;
}

/** The symbols an application writes numbers with. */
export interface NumberSymbols {
  /** Between the thousands: ".". */
  group: string;
  /** Before the fraction: ",". */
  decimal: string;
}

export interface DayOptions {
  /** The lower-case word for a day inside a sentence ("Otvoren jučer"); the date is unchanged. */
  inSentence?: boolean;
  /** The moment "today" is counted from (default: now). */
  now?: Date;
}

export interface MoneyOptions {
  /** An ISO code ("EUR"): `Intl`'s currency style instead of the application's `currencySymbol`. */
  currency?: string;
  /** Fraction digits (default 2; with a `currency`, the currency's own). */
  decimals?: number;
  /** An amount with no fraction shows none ("39.600", not "39.600,00"); any other keeps `decimals`. */
  whole?: boolean;
  /** `false` gives the number alone (default true). */
  symbol?: boolean;
}

/**
 * Formats values for the active locale. The functions read the locale when called, so a template that
 * calls them re-renders when the locale changes. A value with nothing to show (null, not a date, NaN)
 * formats as the empty string: the caller decides what the placeholder looks like.
 */
export interface Formatting {
  /** The locale the next call formats for. */
  readonly locale: string;
  /**
   * Numeric by default: `30. 09. 2026.` in hr, `09/30/2026` in en. With `options` it is `Intl.DateTimeFormat`'s for the active locale
   * (`{ month: "long", year: "numeric" }`; the application's `datePattern` does not apply), and in Bosnian the month words are Bosnian.
   */
  date(value: DateInput, options?: Intl.DateTimeFormatOptions): string;
  dateTime(value: DateInput): string;
  time(value: DateInput): string;
  number(value: number | null | undefined, options?: Intl.NumberFormatOptions): string;
  /**
   * Without a `currency`: the amount through `formatters.number`, then the `currencySymbol` after a space
   * ("1.234,50 KM"), or the bare amount when the application set no symbol. With an ISO `currency` ("EUR"):
   * `Intl`'s currency style. A missing or non-finite amount is the empty string, like the other functions.
   */
  money(amount: number | null | undefined, options?: MoneyOptions): string;
  /** The display symbol the application set (`""` when none), for a caller that draws it apart from the amount. */
  readonly currencySymbol: string;
  /** "3 days ago", "in 2 hours", "now": the largest whole unit. */
  relative(value: DateInput, now?: Date): string;
  /**
   * "Today" and "Yesterday" (the `core.activity.today` / `yesterday` texts of the active language) for those two days, the `date` for any other:
   * what people scan for in recent activity. Without a `translate` in the options it is always the `date`.
   */
  day(value: DateInput, options?: DayOptions): string;
  /** `day` and the time, "Today · 12:57" / "13.09.2026. · 12:57". */
  dayTime(value: DateInput, options?: DayOptions): string;
  /** The BCP 47 tag the active locale is given to `Intl` as (the application's `intlLocale` map over the library's), for a caller that uses `Intl` itself. */
  readonly intlLocale: string;
}

const DATE: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" };
const TIME: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

const RELATIVE_UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
  ["second", 1],
];

/** What the library's own formatters can be told; `createFormatting` passes its options through. */
export interface FormatterSettings {
  /** Language code → the BCP 47 tag `Intl` is given (`{ en: "en-GB", sl: "sl-SI" }`), over the library's own (`bs` → `sr-Latn-BA`: Chromium has no Bosnian data). Time and relative text use it too. */
  intlLocale?: Readonly<Record<string, string>>;
  /**
   * Language code → the numeric date, written with `DD`, `MM`, `YYYY` ("DD.MM.YYYY." is `30.09.2026.`, "DD/MM/YYYY" is `30/09/2026`).
   * The date-time is the same pattern, a space and the 24-hour time. A language not listed keeps `Intl`'s date.
   */
  datePattern?: Readonly<Record<string, string>>;
  /**
   * Writes every number with these symbols, in every language: grouped from four digits (`1.234`), the fraction digits rounded like
   * `toFixed` (so `1.005` at two digits is `1,00`, not `Intl`'s `1,01`), and `useGrouping: false` honoured. A `style` other than decimal
   * (`percent`, `unit`) stays `Intl`'s. Money in an ISO currency is then this number and the currency's symbol ("12,50 €").
   */
  numberSymbols?: NumberSymbols;
}

// Chromium has no Bosnian data and `bs` reads `sr-Latn-BA`, which writes the Serbian jun / jul / avgust: the Bosnian names replace the month word.
const BOSNIAN_TAG = "sr-Latn-BA";
const NOMINATIVE = ["januar", "februar", "mart", "april", "maj", "juni", "juli", "august", "septembar", "oktobar", "novembar", "decembar"];
const GENITIVE = ["januara", "februara", "marta", "aprila", "maja", "juna", "jula", "augusta", "septembra", "oktobra", "novembra", "decembra"];

/** `Intl.DateTimeFormat(tag, options)` of a date; a month written as a word is Bosnian when the tag is `sr-Latn-BA`: genitive with a day, nominative alone, short = its first three letters. */
function formatWithOptions(value: Date, tag: string, options: Intl.DateTimeFormatOptions): string {
  const intl = new Intl.DateTimeFormat(tag, options);
  if (tag !== BOSNIAN_TAG || (options.month !== "long" && options.month !== "short")) return intl.format(value);
  const month = value.getMonth();
  return intl
    .formatToParts(value)
    .map((part) => (part.type !== "month" ? part.value : options.month === "short" ? NOMINATIVE[month]!.slice(0, 3) : (options.day === undefined ? NOMINATIVE : GENITIVE)[month]!))
    .join("");
}

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

/** `toFixed` at `max` digits, trailing zeros trimmed down to `min`, grouped, with the application's symbols. Not for |value| ≥ 1e21 (`toFixed` writes an exponent there). */
function symbolNumber(value: number, options: Intl.NumberFormatOptions | undefined, { group, decimal }: NumberSymbols): string {
  const min = options?.minimumFractionDigits ?? 0;
  const max = Math.max(min, options?.maximumFractionDigits ?? 3);
  const [whole = "", fraction = ""] = value.toFixed(max).split(".");
  let kept = fraction;
  while (kept.length > min && kept.endsWith("0")) kept = kept.slice(0, -1);
  const grouped = options?.useGrouping === false ? whole : whole.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return kept ? `${grouped}${decimal}${kept}` : grouped;
}

/** The library's formatters: `Intl`'s, unless the settings say otherwise. Instances are cached per locale and options because a table formats thousands of cells. */
export function intlFormatters(settings: FormatterSettings = {}): Formatters {
  const cache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat | Intl.RelativeTimeFormat>();
  const cached = <T extends Intl.DateTimeFormat | Intl.NumberFormat | Intl.RelativeTimeFormat>(key: string, create: () => T): T => {
    let found = cache.get(key) as T | undefined;
    if (!found) {
      found = create();
      cache.set(key, found);
    }
    return found;
  };
  const tag = (locale: string) => intlLocale(locale, settings.intlLocale);
  const dateFormat = (locale: string, options: Intl.DateTimeFormatOptions) =>
    cached(`d|${locale}|${JSON.stringify(options)}`, () => new Intl.DateTimeFormat(tag(locale), options));
  const numberFormat = (locale: string, options?: Intl.NumberFormatOptions) =>
    cached(`n|${locale}|${JSON.stringify(options ?? {})}`, () => new Intl.NumberFormat(tag(locale), options));
  const { datePattern, numberSymbols } = settings;
  const written = (value: Date, pattern: string) =>
    pattern.replace(/YYYY|MM|DD|HH|mm/g, (token) =>
      token === "YYYY" ? pad(value.getFullYear(), 4) : token === "MM" ? pad(value.getMonth() + 1) : token === "DD" ? pad(value.getDate()) : token === "HH" ? pad(value.getHours()) : pad(value.getMinutes()),
    );

  return {
    date: (value, locale) => (datePattern?.[locale] ? written(value, datePattern[locale]) : dateFormat(locale, DATE).format(value)),
    dateTime: (value, locale) => (datePattern?.[locale] ? written(value, `${datePattern[locale]} HH:mm`) : dateFormat(locale, { ...DATE, ...TIME }).format(value)),
    time: (value, locale) => dateFormat(locale, TIME).format(value),
    number: (value, locale, options) =>
      numberSymbols && (options?.style ?? "decimal") === "decimal" ? symbolNumber(value, options, numberSymbols) : numberFormat(locale, options).format(value),
    money(amount, currency, locale, options) {
      const intl = cached(`m|${locale}|${currency}|${JSON.stringify(options ?? {})}`, () => new Intl.NumberFormat(tag(locale), { ...options, style: "currency", currency }));
      if (!numberSymbols) return intl.format(amount);
      const symbol = intl.formatToParts(amount).find((part) => part.type === "currency")?.value ?? currency;
      const digits = options?.maximumFractionDigits ?? intl.resolvedOptions().maximumFractionDigits ?? 2;
      return `${symbolNumber(amount, { minimumFractionDigits: digits, maximumFractionDigits: digits }, numberSymbols)} ${symbol}`;
    },
    relative(value, locale, now) {
      const seconds = Math.trunc((value.getTime() - now.getTime()) / 1000);
      const [unit, size] = RELATIVE_UNITS.find(([, length]) => Math.abs(seconds) >= length) ?? RELATIVE_UNITS[RELATIVE_UNITS.length - 1]!;
      return cached(`r|${locale}`, () => new Intl.RelativeTimeFormat(tag(locale), { numeric: "auto" })).format(Math.trunc(seconds / size), unit);
    },
  };
}

export interface FormattingOptions extends FormatterSettings {
  /** The active locale, read on every call (pass `() => i18n.global.locale.value` so it stays reactive). */
  locale: () => string;
  /** Replaces any of the library's formatters. */
  formatters?: Partial<Formatters>;
  /** The symbol shown after an amount when no ISO currency is passed: "€", "KM". It is text, not a currency code. */
  currencySymbol?: string;
  /** What `number` returns for a value with nothing to show (null, undefined, NaN): `"0"`. Default: the empty string, like the other functions. */
  emptyNumber?: string;
  /** A message in the active language, for the words of `day` ("core.activity.today"). Without it `day` is `date`. */
  translate?: (key: string) => string;
}

/** The part of the options an application passes next to its formatters (`createApplication`'s `formatting`): the rest it already owns. */
export type FormattingSettings = Omit<FormattingOptions, "locale" | "formatters" | "translate">;

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function createFormatting(options: FormattingOptions): Formatting {
  const formatters: Formatters = { ...intlFormatters(options), ...options.formatters };
  const finite = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);
  const tag = () => intlLocale(options.locale(), options.intlLocale);
  const time = (value: DateInput) => {
    const date = toDate(value);
    return date ? formatters.time(date, options.locale()) : "";
  };
  const date = (value: DateInput, dateOptions?: Intl.DateTimeFormatOptions) => {
    const parsed = toDate(value);
    if (!parsed) return "";
    return dateOptions ? formatWithOptions(parsed, tag(), dateOptions) : formatters.date(parsed, options.locale());
  };
  const day = (value: DateInput, { inSentence = false, now = new Date() }: DayOptions = {}) => {
    const parsed = toDate(value);
    if (!parsed || !options.translate) return date(value);
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const key = sameDay(parsed, now) ? "core.activity.today" : sameDay(parsed, yesterday) ? "core.activity.yesterday" : null;
    if (!key) return date(value);
    const word = options.translate(key);
    return inSentence ? word.toLocaleLowerCase(tag()) : word.charAt(0).toLocaleUpperCase(tag()) + word.slice(1);
  };

  return {
    get locale() {
      return options.locale();
    },
    get intlLocale() {
      return tag();
    },
    date,
    dateTime: (value) => {
      const date = toDate(value);
      return date ? formatters.dateTime(date, options.locale()) : "";
    },
    time,
    number: (value, numberOptions) => (finite(value) ? formatters.number(value, options.locale(), numberOptions) : (options.emptyNumber ?? "")),
    get currencySymbol() {
      return options.currencySymbol ?? "";
    },
    money: (amount, { currency, decimals, whole, symbol = true } = {}) => {
      if (!finite(amount)) return "";
      const value = amount;
      // The one rule for "whole": the same for <Money whole>, which formats through here.
      const digits = whole && Number.isInteger(value) ? 0 : decimals;
      const intl = digits === undefined ? undefined : { minimumFractionDigits: digits, maximumFractionDigits: digits };
      if (currency && symbol) return formatters.money(value, currency, options.locale(), intl);
      // Through `formatters.number`, so an application's own number format applies to its amounts too.
      const text = formatters.number(value, options.locale(), intl ?? { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return symbol && !currency && options.currencySymbol ? `${text} ${options.currencySymbol}` : text;
    },
    relative: (value, now = new Date()) => {
      const date = toDate(value);
      return date ? formatters.relative(date, options.locale(), now) : "";
    },
    day,
    dayTime: (value, dayOptions) => {
      const text = day(value, dayOptions);
      return text ? `${text} · ${time(value)}` : "";
    },
  };
}

/** The formatting of the app (or of a subtree): `installFormatting(app, createFormatting(...))` once, `useFormat()` below. */
export const [formattingKey, useFormat] = defineFeatureContext<Formatting>("vue-core.formatting");

export function installFormatting(app: App, formatting: Formatting): void {
  app.provide(formattingKey, formatting);
}
