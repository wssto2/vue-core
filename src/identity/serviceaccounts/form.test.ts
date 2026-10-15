import { describe, expect, it } from "vitest";
import { expiryOf, todayOf } from "./form";

describe("expiryOf", () => {
  it("is null without a day, or for text that is no day", () => {
    expect(expiryOf(null)).toBeNull();
    expect(expiryOf("")).toBeNull();
    expect(expiryOf("soon")).toBeNull();
  });

  it("is the end of the chosen day on the clock of the person, as an instant", () => {
    expect(new Date(expiryOf("2027-03-05")!).getTime()).toBe(new Date(2027, 2, 5, 23, 59, 59).getTime());
  });
});

describe("todayOf", () => {
  it("is the day on the clock of the person, padded", () => {
    expect(todayOf(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});
