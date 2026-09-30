import type { App } from "vue";
import { defineFeatureContext } from "../platform/context";

/** What the formatting functions accept for a point in time. Anything that is not a real date reads as "nothing to show". */
export type DateInput = Date | string | number | null | undefined;

// A date without a time ("2026-09-30") is a calendar day, not an instant: read as UTC midnight it
// would show the day before in zones west of Greenwich.
const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Normalizes a value to a `Date`, or null when there is nothing to show: no value, one that is not a
 * date, or an unset one (a go-core server sends Go's zero time, 0001-01-01, for a date that was never
 * set, and some systems send the epoch: neither is a date anybody meant).
 */
export function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  let date: Date;
  if (value instanceof Date) date = value;
  else if (typeof value === "number") date = new Date(value);
  else {
    const civil = CIVIL_DATE.exec(value);
    date = civil ? new Date(Number(civil[1]), Number(civil[2]) - 1, Number(civil[3])) : new Date(value);
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
  money(amount: number, currency: string, locale: string): string;
  /** `now` is the moment to count from. */
  relative(value: Date, locale: string, now: Date): string;
}

/**
 * Formats values for the active locale. The functions read the locale when called, so a template that
 * calls them re-renders when the locale changes. A value with nothing to show (null, not a date, NaN)
 * formats as the empty string: the caller decides what the placeholder looks like.
 */
export interface Formatting {
  /** The locale the next call formats for. */
  readonly locale: string;
  /** Numeric by default: `30. 09. 2026.` in hr, `09/30/2026` in en. */
  date(value: DateInput): string;
  dateTime(value: DateInput): string;
  time(value: DateInput): string;
  number(value: number | null | undefined, options?: Intl.NumberFormatOptions): string;
  money(amount: number | null | undefined, currency: string): string;
  /** "3 days ago", "in 2 hours", "now": the largest whole unit. */
  relative(value: DateInput, now?: Date): string;
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

/** The `Intl`-backed defaults; instances are cached per locale and options because a table formats thousands of cells. */
export function intlFormatters(): Formatters {
  const cache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat | Intl.RelativeTimeFormat>();
  const cached = <T extends Intl.DateTimeFormat | Intl.NumberFormat | Intl.RelativeTimeFormat>(key: string, create: () => T): T => {
    let found = cache.get(key) as T | undefined;
    if (!found) {
      found = create();
      cache.set(key, found);
    }
    return found;
  };
  const dateFormat = (locale: string, options: Intl.DateTimeFormatOptions) =>
    cached(`d|${locale}|${JSON.stringify(options)}`, () => new Intl.DateTimeFormat(locale, options));

  return {
    date: (value, locale) => dateFormat(locale, DATE).format(value),
    dateTime: (value, locale) => dateFormat(locale, { ...DATE, ...TIME }).format(value),
    time: (value, locale) => dateFormat(locale, TIME).format(value),
    number: (value, locale, options) => cached(`n|${locale}|${JSON.stringify(options ?? {})}`, () => new Intl.NumberFormat(locale, options)).format(value),
    money: (amount, currency, locale) =>
      cached(`m|${locale}|${currency}`, () => new Intl.NumberFormat(locale, { style: "currency", currency })).format(amount),
    relative(value, locale, now) {
      const seconds = Math.trunc((value.getTime() - now.getTime()) / 1000);
      const [unit, size] = RELATIVE_UNITS.find(([, length]) => Math.abs(seconds) >= length) ?? RELATIVE_UNITS[RELATIVE_UNITS.length - 1]!;
      return cached(`r|${locale}`, () => new Intl.RelativeTimeFormat(locale, { numeric: "auto" })).format(Math.trunc(seconds / size), unit);
    },
  };
}

export interface FormattingOptions {
  /** The active locale, read on every call (pass `() => i18n.global.locale.value` so it stays reactive). */
  locale: () => string;
  /** Replaces any of the `Intl` defaults. */
  formatters?: Partial<Formatters>;
}

export function createFormatting(options: FormattingOptions): Formatting {
  const formatters: Formatters = { ...intlFormatters(), ...options.formatters };
  const finite = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);

  return {
    get locale() {
      return options.locale();
    },
    date: (value) => {
      const date = toDate(value);
      return date ? formatters.date(date, options.locale()) : "";
    },
    dateTime: (value) => {
      const date = toDate(value);
      return date ? formatters.dateTime(date, options.locale()) : "";
    },
    time: (value) => {
      const date = toDate(value);
      return date ? formatters.time(date, options.locale()) : "";
    },
    number: (value, numberOptions) => (finite(value) ? formatters.number(value, options.locale(), numberOptions) : ""),
    money: (amount, currency) => (finite(amount) ? formatters.money(amount, currency, options.locale()) : ""),
    relative: (value, now = new Date()) => {
      const date = toDate(value);
      return date ? formatters.relative(date, options.locale(), now) : "";
    },
  };
}

/** The formatting of the app (or of a subtree): `installFormatting(app, createFormatting(...))` once, `useFormat()` below. */
export const [formattingKey, useFormat] = defineFeatureContext<Formatting>("vue-core.formatting");

export function installFormatting(app: App, formatting: Formatting): void {
  app.provide(formattingKey, formatting);
}
