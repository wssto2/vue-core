import type { CategorySettings, Preferences, QuietHours } from "../../modules/notification/entities";
import { makeTime, parseTime } from "../../form/date/time";

/** The preferences with one category's setting replaced (what the server answered, or what is shown before it does). */
export function withCategory(preferences: Preferences, settings: CategorySettings): Preferences {
  return { ...preferences, categories: preferences.categories.map((known) => (known.category === settings.category ? settings : known)) };
}

/** One category's e-mail switched here, before the server answers: it is the person's own choice now. */
export function withEmail(preferences: Preferences, category: string, enabled: boolean): Preferences {
  return withCategory(preferences, { category, email: { enabled, source: "person" } });
}

/** Minutes after midnight as the `"HH:mm"` a time field edits. */
export function timeOfMinutes(minutes: number): string {
  return makeTime(Math.floor(minutes / 60), minutes % 60) ?? "00:00";
}

/** A time field's `"HH:mm"` as minutes after midnight; null when it is empty. */
export function minutesOfTime(time: string | null): number | null {
  const parts = parseTime(time);
  return parts === null ? null : parts.hour * 60 + parts.minute;
}

/** What the quiet-hours form edits: the server's minutes as times of day. */
export interface QuietDraft {
  enabled: boolean;
  start: string | null;
  end: string | null;
}

export const draftOf = (quiet: QuietHours): QuietDraft => ({ enabled: quiet.enabled, start: timeOfMinutes(quiet.start), end: timeOfMinutes(quiet.end) });
