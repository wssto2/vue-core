import { describe, expect, it } from "vitest";
import { detectOrder, parseDayText, splitDateTime, type DateParseContext } from "./parse";
import { minutesOf, parseTimeText, timeNow } from "./time";

const words = { today: ["danas", "today"], tomorrow: ["sutra", "tomorrow"], yesterday: ["jučer", "yesterday"] };
const dmy: DateParseContext = { order: ["d", "m", "y"], words, today: "2026-10-01" };
const mdy: DateParseContext = { order: ["m", "d", "y"], words, today: "2026-10-01" };
const ymd: DateParseContext = { order: ["y", "m", "d"], words, today: "2026-10-01" };
const read = (text: string, context = dmy) => parseDayText(text, context);

describe("the order of a written date", () => {
  it("is read off the app's own formatter", () => {
    expect(detectOrder(() => "22.11.2033.")).toEqual(["d", "m", "y"]);
    expect(detectOrder(() => "11/22/2033")).toEqual(["m", "d", "y"]);
    expect(detectOrder(() => "2033-11-22")).toEqual(["y", "m", "d"]);
    expect(detectOrder(() => "22. 11. 33.")).toEqual(["d", "m", "y"]);
    expect(detectOrder(() => "22 Nov 2033")).toEqual(["d", "m", "y"]); // a named month: the usual order
  });
});

describe("a typed date", () => {
  it("reads the whole date in the field's order, with any separator and the trailing dot", () => {
    expect(read("30.09.2026.")).toBe("2026-09-30");
    expect(read("30. 9. 2026")).toBe("2026-09-30");
    expect(read("30/9/2026")).toBe("2026-09-30");
    expect(read("09/30/2026", mdy)).toBe("2026-09-30");
    expect(read("2026-09-30")).toBe("2026-09-30");
    expect(read("2026/9/30", ymd)).toBe("2026-09-30");
  });

  it("fills the year of a day and a month", () => {
    expect(read("30.9.")).toBe("2026-09-30");
    expect(read("9/30", mdy)).toBe("2026-09-30");
  });

  it("reads a day alone as that day of this month", () => {
    expect(read("15")).toBe("2026-10-15");
    expect(read("31")).toBe("2026-10-31");
    expect(read("31", { ...dmy, today: "2026-11-10" })).toBeNull();
  });

  it("reads digits without separators", () => {
    expect(read("3009")).toBe("2026-09-30");
    expect(read("300926")).toBe("2026-09-30");
    expect(read("30092026")).toBe("2026-09-30");
    expect(read("09302026", mdy)).toBe("2026-09-30");
    expect(read("12345")).toBeNull();
  });

  it("puts a two-digit year in the next 30 years or else behind us", () => {
    expect(read("1.1.27")).toBe("2027-01-01");
    expect(read("1.1.85")).toBe("1985-01-01");
  });

  it("reads days from today: +7, -1, and the words", () => {
    expect(read("+7")).toBe("2026-10-08");
    expect(read("-1")).toBe("2026-09-30");
    expect(read("+ 31")).toBe("2026-11-01");
    expect(read("danas")).toBe("2026-10-01");
    expect(read("Today")).toBe("2026-10-01");
    expect(read("sutra")).toBe("2026-10-02");
    expect(read("jučer")).toBe("2026-09-30");
    expect(read("+0")).toBe("2026-10-01");
  });

  it("refuses what is not a real day instead of rolling it over", () => {
    expect(read("29.2.2025.")).toBeNull();
    expect(read("45.13.2025.")).toBeNull();
    expect(read("0.1.2026")).toBeNull();
    expect(read("1.1.0001")).toBe("0001-01-01"); // a real day: the field's min decides, not the parser
    expect(read("1.1.202")).toBeNull();
    expect(read("31.4.")).toBeNull();
    expect(read("abc")).toBeNull();
    expect(read("")).toBeNull();
    expect(read("1.2.3.4")).toBeNull();
  });
});

describe("a typed date and time", () => {
  it("splits the time off", () => {
    expect(splitDateTime("15.10.2026. 14:35")).toEqual({ date: "15.10.2026.", time: "14:35" });
    expect(splitDateTime("15. 10. 2026. 14:35")).toEqual({ date: "15. 10. 2026.", time: "14:35" });
    expect(splitDateTime("danas 14.35")).toEqual({ date: "danas", time: "14.35" });
    expect(splitDateTime("2026-10-15T14:35")).toEqual({ date: "2026-10-15", time: "14:35" });
    expect(splitDateTime("14:35")).toEqual({ date: null, time: "14:35" });
    expect(splitDateTime("15.10.2026.")).toEqual({ date: "15.10.2026.", time: null });
    expect(splitDateTime("1.10")).toEqual({ date: "1.10", time: null }); // one token: a date
    expect(splitDateTime("15. 10.")).toEqual({ date: "15. 10.", time: null });
    expect(splitDateTime("")).toEqual({ date: null, time: null });
  });
});

describe("a typed time", () => {
  const time = (text: string, step = 1) => parseTimeText(text, step);
  it("reads 1435, 14.35, 14:35, 14h35 and the short ones", () => {
    for (const text of ["1435", "14.35", "14:35", "14,35", "14h35", " 14 : 35 "]) expect(time(text)).toEqual({ time: "14:35" });
    expect(time("935")).toEqual({ time: "09:35" });
    expect(time("9")).toEqual({ time: "09:00" });
    expect(time("14")).toEqual({ time: "14:00" });
    expect(time("9.5")).toEqual({ time: "09:05" });
    expect(time("0000")).toEqual({ time: "00:00" });
    expect(time("23:59")).toEqual({ time: "23:59" });
  });

  it("refuses an hour or a minute that does not exist", () => {
    for (const text of ["24:00", "2460", "14:60", "99", "abc", "", "12345", "1:2:3"]) expect(time(text)).toEqual({ error: "invalid" });
  });

  it("refuses a minute off the step, and takes the ones on it", () => {
    expect(time("14:37", 5)).toEqual({ error: "step" });
    expect(time("14:35", 5)).toEqual({ time: "14:35" });
    expect(time("14", 15)).toEqual({ time: "14:00" });
  });

  it("offers every minute, or every step-th", () => {
    expect(minutesOf(1)).toHaveLength(60);
    expect(minutesOf(15)).toEqual([0, 15, 30, 45]);
    expect(minutesOf(7).at(-1)).toBe(56);
    expect(minutesOf(0)).toHaveLength(60);
  });

  it("rounds now down to the step", () => {
    expect(timeNow(1, new Date(2026, 9, 1, 14, 37))).toBe("14:37");
    expect(timeNow(5, new Date(2026, 9, 1, 14, 37))).toBe("14:35");
    expect(timeNow(5, new Date(2026, 9, 1, 23, 58))).toBe("23:55");
  });
});
