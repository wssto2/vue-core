import { describe, expect, it } from "vitest";
import type { Preferences } from "../../modules/notification/entities";
import { draftOf, minutesOfTime, timeOfMinutes, withCategory, withEmail } from "./state";

const preferences: Preferences = {
  email_available: true,
  categories: [
    { category: "tickets.assigned", email: { enabled: true, source: "default" } },
    { category: "tickets.commented", email: { enabled: false, source: "enforced" } },
  ],
  quiet_hours: { enabled: true, start: 1260, end: 420 },
  time_zone: "Europe/Zagreb",
};

describe("the settings state", () => {
  it("switches one category as the person's own choice and leaves the rest", () => {
    const next = withEmail(preferences, "tickets.assigned", false);
    expect(next.categories[0]).toEqual({ category: "tickets.assigned", email: { enabled: false, source: "person" } });
    expect(next.categories[1]).toBe(preferences.categories[1]);
    expect(preferences.categories[0]!.email.source).toBe("default");
  });

  it("takes what the server answered for a category", () => {
    const next = withCategory(preferences, { category: "tickets.assigned", email: { enabled: true, source: "default" } });
    expect(next.categories[0]!.email.source).toBe("default");
  });

  it("converts quiet hours between minutes after midnight and times of day", () => {
    expect(timeOfMinutes(0)).toBe("00:00");
    expect(timeOfMinutes(1260)).toBe("21:00");
    expect(timeOfMinutes(1439)).toBe("23:59");
    expect(minutesOfTime("07:05")).toBe(425);
    expect(minutesOfTime(null)).toBeNull();
    expect(minutesOfTime("7")).toBeNull();
    expect(draftOf(preferences.quiet_hours)).toEqual({ enabled: true, start: "21:00", end: "07:00" });
  });
});
