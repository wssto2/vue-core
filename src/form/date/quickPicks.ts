import { addDays, endOfMonth, nextWorkingDay, type Day } from "./days";
import type { Time } from "./time";

/**
 * A shortcut under a calendar. The named ones are the library's (its own wording, in the app's language); an object is the
 * app's own: `{ label: "Next delivery day", day: (today) => nextDeliveryDay(today) }`, computed from today when asked.
 * "Next working day" skips Saturday and Sunday only; an app with public holidays passes its own.
 */
export type QuickPick = "today" | "tomorrow" | "week" | "month-end" | "next-working-day" | { label: string; day: (today: Day) => Day };

/** A shortcut of a time field: now, or a time of day. */
export type QuickTime = "now" | Time | { label: string; time: () => Time };

/** The shortcuts of a date field on a wide screen and on a phone, where the artboards differ. */
export const defaultQuickPicks = (compact: boolean): readonly QuickPick[] => (compact ? ["today", "tomorrow", "next-working-day"] : ["today", "tomorrow", "week", "month-end"]);

export const defaultQuickTimes: readonly QuickTime[] = ["now", "08:00", "12:00"];

const NAMED: Record<Exclude<QuickPick, { label: string }>, (today: Day) => Day> = {
  today: (today) => today,
  tomorrow: (today) => addDays(today, 1),
  week: (today) => addDays(today, 7),
  "month-end": (today) => endOfMonth(today),
  "next-working-day": (today) => nextWorkingDay(today),
};

export interface Shortcut {
  key: string;
  label: string;
  /** A day, or a time of day. */
  value: string;
}

/** A shortcut's day, and the text on its chip (`label` is what the library says for a named one). */
export function resolveQuickPick(pick: QuickPick, label: (name: string) => string, today: Day): Shortcut {
  if (typeof pick === "string") return { key: pick, label: label(pick), value: NAMED[pick](today) };
  return { key: pick.label, label: pick.label, value: pick.day(today) };
}

/** A time shortcut: "Now" (rounded down to the step), a time of day (`8:00`) or the app's own. */
export function resolveQuickTime(pick: QuickTime, nowLabel: string, now: Time): Shortcut {
  if (pick === "now") return { key: "now", label: nowLabel, value: now };
  if (typeof pick === "string") return { key: pick, label: `${Number(pick.slice(0, 2))}${pick.slice(2)}`, value: pick };
  return { key: pick.label, label: pick.label, value: pick.time() };
}
