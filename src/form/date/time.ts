/** A time of day on the clock of the user, `"HH:mm"` (24 hours, no zone, no seconds). */
export type Time = string;

export interface TimeOfDay {
  hour: number;
  minute: number;
}

const TIME_PATTERN = /^(\d{2}):(\d{2})$/;
const pad = (value: number) => String(value).padStart(2, "0");

export function makeTime(hour: number, minute: number): Time | null {
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${pad(hour)}:${pad(minute)}`;
}

/** Reads `"14:35"` strictly. */
export function parseTime(text: string | null | undefined): TimeOfDay | null {
  const match = text ? TIME_PATTERN.exec(text) : null;
  if (!match) return null;
  return makeTime(Number(match[1]), Number(match[2])) ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

export const isTime = (text: string | null | undefined): text is Time => parseTime(text) !== null;

/** The minutes of an hour a list offers: every one by default, or every `step`th (`0, 5, 10, …`). */
export function minutesOf(step: number): number[] {
  const size = Number.isInteger(step) && step >= 1 && step <= 30 ? step : 1;
  return Array.from({ length: Math.ceil(60 / size) }, (_, index) => index * size);
}

export const HOURS: readonly number[] = Array.from({ length: 24 }, (_, hour) => hour);

/** The time now, rounded down to the step (23:58 with a step of 5 is 23:55: rounding up could leave the day). */
export function timeNow(step = 1, now: Date = new Date()): Time {
  const size = Number.isInteger(step) && step >= 1 && step <= 30 ? step : 1;
  return makeTime(now.getHours(), now.getMinutes() - (now.getMinutes() % size)) ?? "00:00";
}

export type TimeParse = { time: Time } | { error: "invalid" | "step" };

/**
 * Reads a typed time: `14:35`, `14.35`, `14,35`, `14h35`, `1435`, `935` (9:35), `14` (14:00), `9.5` (9:05).
 * With a `step` a minute that is not a multiple of it is an error (`step`), never silently moved.
 */
export function parseTimeText(text: string, step = 1): TimeParse {
  const value = text.trim().toLowerCase();
  let hour: number;
  let minute: number;
  const separated = /^(\d{1,2})\s*[:.,h]\s*(\d{1,2})?$/.exec(value);
  if (separated) {
    hour = Number(separated[1]);
    minute = separated[2] === undefined ? 0 : Number(separated[2]);
  } else if (/^\d{1,2}$/.test(value)) {
    hour = Number(value);
    minute = 0;
  } else if (/^\d{3,4}$/.test(value)) {
    hour = Number(value.slice(0, -2));
    minute = Number(value.slice(-2));
  } else return { error: "invalid" };

  const time = makeTime(hour, minute);
  if (!time) return { error: "invalid" };
  return step > 1 && minute % step !== 0 ? { error: "step" } : { time };
}
