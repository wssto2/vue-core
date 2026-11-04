import { makeDay, parseDay, today } from "./days";
import { joinDateTime } from "./time";

// Go zero-time sentinels an unset *time.Time / shared.Date can still surface as in older payloads.
const GO_ZERO_DATE = /^(0000-00-00|1970-01-01|0001-01-01)/;
const pad = (value: number) => String(value).padStart(2, "0");
const localDay = (date: Date) => makeDay(date.getFullYear(), date.getMonth() + 1, date.getDate());
const localTime = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}` as const;

/**
 * An API date or timestamp as the `YYYY-MM-DD` a `DateField` binds, or null (empty, the Go zero date, not a date). A string is sliced as
 * written, never read through `new Date()`, which would move the day across midnight in a zone away from UTC; a `Date` is read on the
 * user's clock.
 */
export function dateValue(value: string | Date | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : localDay(value);
  if (GO_ZERO_DATE.test(value)) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match && parseDay(match[1]) ? match[1]! : null;
}

/**
 * An API timestamp as the `YYYY-MM-DDTHH:mm` a `DateTimeField` binds (the user's clock, minutes), or null. An instant with an offset
 * (`...Z`, `+01:00`) is converted; a value without one (`2026-09-30 14:35`) is already local.
 */
export function dateTimeValue(value: string | Date | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string" && GO_ZERO_DATE.test(value)) return null;
  const date = value instanceof Date ? value : parseDateValue(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = localDay(date);
  return day ? joinDateTime(day, localTime(date)) : null;
}

/**
 * A date model or API value as a `Date`. `YYYY-MM-DDTHH:mm` and the older `YYYY-MM-DD HH:mm` are both read as local time (Safari rejects
 * the space), and a bare `YYYY-MM-DD` is local midnight, not UTC. Anything else goes to `new Date`. An unreadable value is an invalid
 * `Date` (`getTime()` is NaN).
 */
export function parseDateValue(value: string): Date {
  const local = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
  if (local) return new Date(Number(local[1]), Number(local[2]) - 1, Number(local[3]), Number(local[4] ?? 0), Number(local[5] ?? 0), Number(local[6] ?? 0));
  return new Date(value);
}

/** The current minute on the user's clock, as a `DateTimeField` value. */
export function now(clock: Date = new Date()): string {
  return dateTimeValue(clock) ?? "";
}

export { today };
