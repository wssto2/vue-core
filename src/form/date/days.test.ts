import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  addYears,
  clampDay,
  daysInMonth,
  endOfMonth,
  firstWeekday,
  isDayDisabled,
  makeDay,
  monthGrid,
  moveDay,
  nextWorkingDay,
  parseDay,
  startOfWeek,
  today,
  weekday,
  weekendDays,
} from "./days";

const grid = (year: number, month: number, first = 1, extra: Partial<Parameters<typeof monthGrid>[2]> = {}) =>
  monthGrid(year, month, { firstWeekday: first, weekend: [6, 7], today: "2026-10-15", selected: null, rules: {}, ...extra });

describe("days", () => {
  it("knows a real day from an impossible one", () => {
    expect(makeDay(2026, 2, 29)).toBeNull();
    expect(makeDay(2028, 2, 29)).toBe("2028-02-29");
    expect(makeDay(2026, 13, 1)).toBeNull();
    expect(parseDay("2026-09-31")).toBeNull();
    expect(parseDay("2026-9-30")).toBeNull();
    expect(parseDay("2026-09-30")).toEqual({ year: 2026, month: 9, day: 30 });
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
  });

  it("does its arithmetic on the calendar, across months, years and leap days", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-01-31", -2)).toBe("2025-11-30");
    expect(addYears("2028-02-29", 1)).toBe("2029-02-28");
    expect(endOfMonth("2026-09-10")).toBe("2026-09-30");
  });

  it("numbers the weekdays like Intl does, 1 for Monday", () => {
    expect(weekday("2026-10-01")).toBe(4); // a Thursday
    expect(weekday("2026-10-04")).toBe(7);
    expect(weekday("1999-12-31")).toBe(5);
    expect(startOfWeek("2026-10-01", 1)).toBe("2026-09-28");
    expect(startOfWeek("2026-10-01", 7)).toBe("2026-09-27");
    expect(nextWorkingDay("2026-10-02")).toBe("2026-10-05"); // Friday to Monday
    expect(nextWorkingDay("2026-10-01")).toBe("2026-10-02");
  });

  it("reads the first weekday of the locale", () => {
    expect(firstWeekday("hr")).toBe(1);
    expect(firstWeekday("bs")).toBe(1);
    expect(firstWeekday("en-US")).toBe(7);
    expect(firstWeekday("en-GB")).toBe(1);
    expect(firstWeekday("not a locale")).toBe(1);
    expect(weekendDays("hr")).toEqual([6, 7]);
  });

  it("does not drift with the clock of the zone", () => {
    expect(today(new Date(2026, 2, 29, 23, 59))).toBe("2026-03-29"); // the night the clocks go forward
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
  });
});

describe("month grid", () => {
  it("lays October 2026 out in five weeks starting on Monday", () => {
    const weeks = grid(2026, 10);
    expect(weeks).toHaveLength(5);
    expect(weeks[0]!.map((cell) => cell.date)).toEqual([28, 29, 30, 1, 2, 3, 4]);
    expect(weeks[0]!.map((cell) => cell.inMonth)).toEqual([false, false, false, true, true, true, true]);
    expect(weeks[4]!.map((cell) => cell.date)).toEqual([26, 27, 28, 29, 30, 31, 1]);
  });

  it("starts the week on the first weekday of the locale", () => {
    const weeks = grid(2026, 10, 7);
    expect(weeks[0]!.map((cell) => cell.date)).toEqual([27, 28, 29, 30, 1, 2, 3]);
    expect(weeks[0]![0]!.weekend).toBe(true);
  });

  it("needs four rows for a February that starts on the first weekday, and six where a month spills over", () => {
    expect(grid(2027, 2)).toHaveLength(4); // 1 February 2027 is a Monday
    expect(grid(2026, 8)).toHaveLength(6); // 31 days from a Saturday
  });

  it("marks today, the selected day, the weekend and what is out of range", () => {
    const weeks = grid(2026, 10, 1, { selected: "2026-10-20", rules: { min: "2026-10-10", max: "2026-10-25", disabled: ["2026-10-22"] } });
    const cells = weeks.flat();
    const at = (day: string) => cells.find((cell) => cell.day === day)!;
    expect(at("2026-10-15").today).toBe(true);
    expect(at("2026-10-20").selected).toBe(true);
    expect(at("2026-10-03").weekend).toBe(true);
    expect(at("2026-10-09").disabled).toBe(true);
    expect(at("2026-10-10").disabled).toBe(false);
    expect(at("2026-10-25").disabled).toBe(false);
    expect(at("2026-10-26").disabled).toBe(true);
    expect(at("2026-10-22").disabled).toBe(true);
  });
});

describe("disabled days", () => {
  it("takes single days, ranges and a predicate", () => {
    expect(isDayDisabled("2026-10-05", { disabled: [{ from: "2026-10-01", to: "2026-10-05" }] })).toBe(true);
    expect(isDayDisabled("2026-10-06", { disabled: [{ from: "2026-10-01", to: "2026-10-05" }] })).toBe(false);
    expect(isDayDisabled("2026-10-03", { disabled: (day) => weekday(day) >= 6 })).toBe(true);
    expect(clampDay("2026-01-01", { min: "2026-06-01" })).toBe("2026-06-01");
    expect(clampDay("2027-01-01", { max: "2026-06-01" })).toBe("2026-06-01");
  });
});

describe("keyboard model", () => {
  it("moves by a day, a week, a month, a year and to the week's ends", () => {
    const from = "2026-10-15"; // a Thursday
    expect(moveDay(from, "ArrowLeft", false, 1)).toBe("2026-10-14");
    expect(moveDay(from, "ArrowRight", false, 1)).toBe("2026-10-16");
    expect(moveDay(from, "ArrowUp", false, 1)).toBe("2026-10-08");
    expect(moveDay(from, "ArrowDown", false, 1)).toBe("2026-10-22");
    expect(moveDay(from, "PageUp", false, 1)).toBe("2026-09-15");
    expect(moveDay(from, "PageDown", false, 1)).toBe("2026-11-15");
    expect(moveDay(from, "PageUp", true, 1)).toBe("2025-10-15");
    expect(moveDay(from, "PageDown", true, 1)).toBe("2027-10-15");
    expect(moveDay(from, "Home", false, 1)).toBe("2026-10-12");
    expect(moveDay(from, "End", false, 1)).toBe("2026-10-18");
    expect(moveDay(from, "End", false, 7)).toBe("2026-10-17");
    expect(moveDay(from, "x", false, 1)).toBeNull();
  });

  it("keeps the day of the month where the next month is shorter", () => {
    expect(moveDay("2026-01-31", "PageDown", false, 1)).toBe("2026-02-28");
  });
});
