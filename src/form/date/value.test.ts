import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { dateTimeValue, dateValue, now, parseDateValue, today } from "./value";

// Spring forward 2026-03-29 02:00 -> 03:00 and fall back 2026-10-25 03:00 -> 02:00 in Zagreb.
const zone = process.env.TZ;
afterAll(() => {
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});
beforeAll(() => {
  process.env.TZ = "Europe/Zagreb";
  expect(new Date("2026-07-01T00:00:00Z").getHours()).toBe(2); // the zone took
});
afterEach(() => vi.useRealTimers());

describe("dateValue", () => {
  it("slices the date as written, whatever the zone does to the instant", () => {
    expect(dateValue("2026-03-28T23:30:00Z")).toBe("2026-03-28"); // 00:30 on the 29th in Zagreb
    expect(dateValue("2026-03-29T00:00:00+01:00")).toBe("2026-03-29");
    expect(dateValue("2026-10-25")).toBe("2026-10-25");
  });

  it("is null for empty, the Go zero dates and text that is no date", () => {
    for (const value of [null, undefined, "", "0001-01-01T00:00:00Z", "0000-00-00", "1970-01-01", "soon", "2026-02-30"]) expect(dateValue(value), String(value)).toBeNull();
    expect(dateValue(new Date("nope"))).toBeNull();
  });

  it("reads a Date on the user's clock", () => {
    expect(dateValue(new Date(2026, 2, 29, 0, 30))).toBe("2026-03-29");
  });
});

describe("dateTimeValue", () => {
  it("writes the shape DateTimeField writes, on the user's clock", () => {
    expect(dateTimeValue("2026-01-15T10:05:00Z")).toBe("2026-01-15T11:05");
    expect(dateTimeValue("2026-01-15 10:05")).toBe("2026-01-15T10:05");
    expect(dateTimeValue("2026-01-15T10:05")).toBe("2026-01-15T10:05");
  });

  it("follows the clock across the spring change: 01:59 then 03:00 local", () => {
    expect(dateTimeValue("2026-03-29T00:59:00Z")).toBe("2026-03-29T01:59");
    expect(dateTimeValue("2026-03-29T01:00:00Z")).toBe("2026-03-29T03:00");
  });

  it("follows the clock across the autumn change: both 02:30s read 02:30", () => {
    expect(dateTimeValue("2026-10-25T00:30:00Z")).toBe("2026-10-25T02:30"); // CEST
    expect(dateTimeValue("2026-10-25T01:30:00Z")).toBe("2026-10-25T02:30"); // CET
    expect(dateTimeValue("2026-10-25T02:00:00Z")).toBe("2026-10-25T03:00");
  });

  it("is null for empty, the Go zero date and an unreadable value", () => {
    for (const value of [null, undefined, "", "0001-01-01T00:00:00Z", "tomorrow"]) expect(dateTimeValue(value), String(value)).toBeNull();
  });

  it("round-trips through parseDateValue", () => {
    for (const model of ["2026-03-29T03:30", "2026-10-25T03:00", "2026-06-01T00:00", "2026-12-31T23:59"]) expect(dateTimeValue(parseDateValue(model))).toBe(model);
  });
});

describe("parseDateValue", () => {
  it("reads the T form and the space form as the same local time", () => {
    const t = parseDateValue("2026-03-29T03:30");
    expect(parseDateValue("2026-03-29 03:30").getTime()).toBe(t.getTime());
    expect([t.getDate(), t.getHours(), t.getMinutes()]).toEqual([29, 3, 30]);
  });

  it("reads a bare date as local midnight, not UTC", () => {
    const day = parseDateValue("2026-03-29");
    expect([day.getDate(), day.getHours()]).toEqual([29, 0]);
  });

  it("hands an RFC 3339 instant to Date, and an unreadable value is an invalid Date", () => {
    expect(parseDateValue("2026-03-29T01:00:00Z").getTime()).toBe(Date.UTC(2026, 2, 29, 1));
    expect(Number.isNaN(parseDateValue("tomorrow").getTime())).toBe(true);
  });
});

describe("now and today", () => {
  it("now is the current minute on the user's clock, in the field's shape", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-29T00:59:30Z"));
    expect(now()).toBe("2026-03-29T01:59");
    vi.setSystemTime(new Date("2026-03-29T01:00:00Z")); // one minute later, the clock jumps an hour
    expect(now()).toBe("2026-03-29T03:00");
  });

  it("today is the user's day, also when UTC is still yesterday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T23:30:00Z"));
    expect(today()).toBe("2026-03-29");
  });
});
