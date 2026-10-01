import { addDays, makeDay, today as todayOf, type Day } from "./days";

/** The three parts of a written date, in the order the app writes them: `["d", "m", "y"]` for `30.09.2026.`. */
export type DatePart = "d" | "m" | "y";

export const DEFAULT_ORDER: readonly DatePart[] = ["d", "m", "y"];

/**
 * The order of day, month and year in the way the app writes dates, found by writing a day that tells them apart
 * (22 November 2033) through the app's own formatter. The typed text is read in the order the field shows it, whatever
 * the locale or the formatter the app chose.
 */
export function detectOrder(format: (day: Day) => string): readonly DatePart[] {
  const text = format("2033-11-22");
  const at = { y: text.indexOf("2033") >= 0 ? text.indexOf("2033") : text.indexOf("33"), m: text.indexOf("11"), d: text.indexOf("22") };
  if (at.y < 0 || at.m < 0 || at.d < 0) return DEFAULT_ORDER;
  return (["d", "m", "y"] as DatePart[]).sort((a, b) => at[a] - at[b]);
}

/** What a keyword typed into a date field means, in the language of the field (the English words always work). */
export interface DateWords {
  today: readonly string[];
  tomorrow: readonly string[];
  yesterday: readonly string[];
}

export interface DateParseContext {
  order: readonly DatePart[];
  words: DateWords;
  /** Today, injected so a test can fix it. */
  today?: Day;
}

const normalize = (text: string) => text.trim().toLowerCase().replace(/\.+$/, "");

function fullYear(raw: string, today: Day): number | null {
  if (raw.length === 4) return Number(raw);
  if (raw.length > 2) return null;
  // Two digits: the century that puts the year within the next 30 years, or else behind us.
  const candidate = 2000 + Number(raw);
  return candidate > Number(today.slice(0, 4)) + 30 ? candidate - 100 : candidate;
}

function fromParts(values: Partial<Record<DatePart, string>>, today: Day): Day | null {
  const year = values.y === undefined ? Number(today.slice(0, 4)) : fullYear(values.y, today);
  const month = values.m === undefined ? Number(today.slice(5, 7)) : Number(values.m);
  if (year === null || values.d === undefined) return null;
  return makeDay(year, month, Number(values.d));
}

/**
 * Reads a typed date. Besides the whole date in the field's order (`30.09.2026.`, `30. 9. 2026`, or ISO `2026-09-30`):
 * `30.9.` (this year), `15` (this month), `3009`, `300926` and `30092026` (no separators), `+7` and `-1` (days from today),
 * and the words today, tomorrow and yesterday. Anything that is not a real day (30 February, month 13) is null: nothing is
 * rolled over into another day.
 */
export function parseDayText(text: string, context: DateParseContext): Day | null {
  const today = context.today ?? todayOf();
  const value = normalize(text);
  if (value === "") return null;

  const { words } = context;
  if (words.today.includes(value)) return today;
  if (words.tomorrow.includes(value)) return addDays(today, 1);
  if (words.yesterday.includes(value)) return addDays(today, -1);

  const relative = /^([+-])\s*(\d{1,4})$/.exec(value);
  if (relative) return addDays(today, Number(relative[2]) * (relative[1] === "-" ? -1 : 1));

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (iso) return makeDay(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  if (!/^[\d\s./-]+$/.test(value)) return null;
  const order = context.order;
  const withoutYear = order.filter((part) => part !== "y");

  if (/^\d+$/.test(value)) {
    // No separators: one or two digits are a day of this month; 4, 6 and 8 digits are the parts written without them.
    if (value.length <= 2) return fromParts({ d: value }, today);
    if (value.length === 4) return fromParts(pick(withoutYear, [value.slice(0, 2), value.slice(2)]), today);
    if (value.length === 6 || value.length === 8) {
      const sizes = order.map((part) => (part === "y" ? value.length - 4 : 2));
      let from = 0;
      const parts = order.map((part, index) => [part, value.slice(from, (from += sizes[index]!))] as const);
      return fromParts(Object.fromEntries(parts), today);
    }
    return null;
  }

  const numbers = value.split(/[^\d]+/).filter(Boolean);
  if (numbers.length === 3) return fromParts(pick(order, numbers), today);
  if (numbers.length === 2) return fromParts(pick(withoutYear, numbers), today);
  if (numbers.length === 1) return fromParts({ d: numbers[0] }, today);
  return null;
}

function pick(parts: readonly DatePart[], values: string[]): Partial<Record<DatePart, string>> {
  return Object.fromEntries(parts.map((part, index) => [part, values[index]]));
}

/** A typed date and time: `15.10.2026. 14:35`, `danas 14.35`, a bare `14:35` (time only) or just a date. Either part may be null. */
export function splitTypedDateTime(text: string): { date: string | null; time: string | null } {
  const tokens = text.trim().replace(/^(\d{4}-\d{2}-\d{2})T/, "$1 ").split(/\s+/).filter(Boolean);
  const last = tokens[tokens.length - 1];
  if (last === undefined) return { date: null, time: null };
  const isTime = last.includes(":") || (tokens.length > 1 && /^\d{1,2}\.\d{2}$/.test(last));
  if (!isTime) return { date: tokens.join(" "), time: null };
  const date = tokens.slice(0, -1).join(" ");
  return { date: date === "" ? null : date, time: last };
}

/** A short way to write a day in the app's order, from today: `1.10.` for `01.10.2026.` (a placeholder's example). */
export function shortExample(format: (day: Day) => string, order: readonly DatePart[], today: Day): string {
  const written = format(today);
  const separator = /\D+/.exec(written)?.[0].trim() ?? ".";
  const trailing = /\D+$/.test(written) ? separator : "";
  const values = { d: String(Number(today.slice(8))), m: String(Number(today.slice(5, 7))), y: "" };
  return order.filter((part) => part !== "y").map((part) => values[part]).join(separator) + trailing;
}
