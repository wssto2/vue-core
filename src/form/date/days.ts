/**
 * The calendar model: calendar days as text (`"2026-09-30"`), never as `Date`. A day is a civil
 * date, so adding days or months is arithmetic on year, month and day (through UTC, which has no
 * daylight saving) and cannot drift across a time zone or a clock change. Headless: the calendar
 * component, the parsers and the quick picks all stand on this file.
 */

/** A calendar day, `"YYYY-MM-DD"` (years 0001 to 9999). Sorts and compares as text. */
export type Day = string;

export interface Civil {
  year: number;
  month: number; // 1 to 12
  day: number;
}

/** Days that cannot be picked: single days, `{ from, to }` ranges (both included), or a predicate for anything else (weekends, holidays). */
export type DisabledDates = readonly (Day | { from: Day; to: Day })[] | ((day: Day) => boolean);

/** What limits the days of a calendar. */
export interface DayRules {
  min?: Day | null;
  max?: Day | null;
  disabled?: DisabledDates;
}

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

const LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const isLeap = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

export const daysInMonth = (year: number, month: number): number => (month === 2 && isLeap(year) ? 29 : (LENGTHS[month - 1] ?? 0));

/** The day with this year, month and day, or null when there is no such day (30 February, month 13). */
export function makeDay(year: number, month: number, day: number): Day | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** Reads `"2026-09-30"` strictly: an impossible day is null, it is never rolled into the next month. */
export function parseDay(text: string | null | undefined): Civil | null {
  const match = text ? DAY_PATTERN.exec(text) : null;
  if (!match) return null;
  const civil = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return makeDay(civil.year, civil.month, civil.day) ? civil : null;
}

export const isDay = (text: string | null | undefined): text is Day => parseDay(text) !== null;

const toDay = (civil: Civil): Day => `${pad(civil.year, 4)}-${pad(civil.month)}-${pad(civil.day)}`;

/** Whole days since 1970-01-01. */
function dayNumber(civil: Civil): number {
  const date = new Date(0);
  date.setUTCFullYear(civil.year, civil.month - 1, civil.day);
  return Math.round(date.getTime() / MS_PER_DAY);
}

function fromDayNumber(count: number): Civil {
  const date = new Date(count * MS_PER_DAY);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

const civilOf = (day: Day): Civil => parseDay(day) ?? { year: 1970, month: 1, day: 1 };

export function addDays(day: Day, count: number): Day {
  return toDay(fromDayNumber(dayNumber(civilOf(day)) + count));
}

/** Months later or earlier, keeping the day of the month where the month has it, else its last day (31 January + 1 month = 28 or 29 February). */
export function addMonths(day: Day, count: number): Day {
  const civil = civilOf(day);
  const index = civil.year * 12 + (civil.month - 1) + count;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return makeDay(year, month, Math.min(civil.day, daysInMonth(year, month))) ?? day;
}

export const addYears = (day: Day, count: number): Day => addMonths(day, count * 12);

/** The first of the month and its last day. */
export const startOfMonth = (day: Day): Day => toDay({ ...civilOf(day), day: 1 });
export function endOfMonth(day: Day): Day {
  const civil = civilOf(day);
  return toDay({ ...civil, day: daysInMonth(civil.year, civil.month) });
}

/** 1 (Monday) to 7 (Sunday), as `Intl` numbers the days of the week. */
export function weekday(day: Day): number {
  const value = (dayNumber(civilOf(day)) + 3) % 7; // 1970-01-01 was a Thursday
  return (value < 0 ? value + 7 : value) + 1;
}

export function startOfWeek(day: Day, firstWeekday: number): Day {
  return addDays(day, -((weekday(day) - firstWeekday + 7) % 7));
}

export const endOfWeek = (day: Day, firstWeekday: number): Day => addDays(startOfWeek(day, firstWeekday), 6);

/** The first working day (Monday to Friday) after `day`. Public holidays are the app's own rule: it passes its own quick pick. */
export function nextWorkingDay(day: Day): Day {
  let next = addDays(day, 1);
  while (weekday(next) >= 6) next = addDays(next, 1);
  return next;
}

/** The day today on the clock of the user, read when asked. */
export function today(now: Date = new Date()): Day {
  return makeDay(now.getFullYear(), now.getMonth() + 1, now.getDate()) ?? "1970-01-01";
}

export function isDayDisabled(day: Day, rules: DayRules): boolean {
  if (rules.min && day < rules.min) return true;
  if (rules.max && day > rules.max) return true;
  const disabled = rules.disabled;
  if (!disabled) return false;
  if (typeof disabled === "function") return disabled(day);
  return disabled.some((entry) => (typeof entry === "string" ? entry === day : day >= entry.from && day <= entry.to));
}

/** The nearest day inside `min` and `max`. */
export function clampDay(day: Day, rules: DayRules): Day {
  if (rules.min && day < rules.min) return rules.min;
  if (rules.max && day > rules.max) return rules.max;
  return day;
}

/** The locale's first day of the week, 1 (Monday) to 7 (Sunday). Monday where the platform does not know. */
export function firstWeekday(locale: string): number {
  return weekInfo(locale)?.firstDay ?? 1;
}

/** The days of the week that are a weekend in the locale (Saturday and Sunday where the platform does not know). */
export function weekendDays(locale: string): readonly number[] {
  return weekInfo(locale)?.weekend ?? [6, 7];
}

interface WeekInfo {
  firstDay: number;
  weekend: number[];
}

function weekInfo(locale: string): WeekInfo | null {
  try {
    const intl = new Intl.Locale(locale) as Intl.Locale & { getWeekInfo?: () => WeekInfo; weekInfo?: WeekInfo };
    return intl.getWeekInfo?.() ?? intl.weekInfo ?? null;
  } catch {
    return null;
  }
}

export interface CalendarCell {
  day: Day;
  /** The day of the month, 1 to 31. */
  date: number;
  /** In the month shown (the others complete the first and last week). */
  inMonth: boolean;
  weekend: boolean;
  today: boolean;
  selected: boolean;
  disabled: boolean;
}

export interface MonthGridOptions {
  firstWeekday: number;
  weekend: readonly number[];
  today: Day;
  selected: Day | null;
  rules: DayRules;
}

/** The weeks of a month: as many rows as it needs (4 to 6), each of seven days, starting on the locale's first weekday. */
export function monthGrid(year: number, month: number, options: MonthGridOptions): CalendarCell[][] {
  const first = makeDay(year, month, 1) ?? "1970-01-01";
  const last = endOfMonth(first);
  const weeks: CalendarCell[][] = [];
  for (let start = startOfWeek(first, options.firstWeekday); start <= last; start = addDays(start, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, offset) => {
        const day = addDays(start, offset);
        return {
          day,
          date: Number(day.slice(8)),
          inMonth: day.startsWith(first.slice(0, 7)),
          weekend: options.weekend.includes(weekday(day)),
          today: day === options.today,
          selected: day === options.selected,
          disabled: isDayDisabled(day, options.rules),
        };
      }),
    );
  }
  return weeks;
}

/**
 * Where a key moves the focused day (the WAI-ARIA date picker dialog): arrows by a day or a week, Page Up and Down by a
 * month (with Shift a year), Home and End to the start and the end of the week. Null for any other key.
 */
export function moveDay(day: Day, key: string, shift: boolean, first: number): Day | null {
  switch (key) {
    case "ArrowLeft":
      return addDays(day, -1);
    case "ArrowRight":
      return addDays(day, 1);
    case "ArrowUp":
      return addDays(day, -7);
    case "ArrowDown":
      return addDays(day, 7);
    case "PageUp":
      return shift ? addYears(day, -1) : addMonths(day, -1);
    case "PageDown":
      return shift ? addYears(day, 1) : addMonths(day, 1);
    case "Home":
      return startOfWeek(day, first);
    case "End":
      return endOfWeek(day, first);
    default:
      return null;
  }
}
