import { describe, expect, it } from "vitest";
import { createFormatting } from "../format";
import { numberMarks, parseNumber } from "./number";

const hr = { decimals: 2, group: "." };
const en = { decimals: 2, group: "," };

describe("parseNumber", () => {
  it.each([
    ["", null],
    ["  ", null],
    ["1234", 1234],
    ["1234,5", 1234.5],
    ["1234.5", 1234.5],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["1.234.567", 1234567],
    ["1 234,5", 1234.5],
    ["0,005", 0.01],
    ["12,345", 12.35],
  ])("reads %j in hr as %j", (text, expected) => expect(parseNumber(text, hr)).toBe(expected));

  it("reads a single grouping mark followed by three digits as thousands, and any other single mark as the decimal mark", () => {
    expect(parseNumber("1.000", hr)).toBe(1000);
    expect(parseNumber("1.50", hr)).toBe(1.5);
    expect(parseNumber("1,000", en)).toBe(1000);
    expect(parseNumber("1,5", en)).toBe(1.5);
  });

  it("rounds to the decimals", () => expect(parseNumber("1,239", { decimals: 2, group: "." })).toBe(1.24));

  it("takes marks as grouping when no decimals are allowed", () => {
    expect(parseNumber("1.5", { decimals: 0, group: "." })).toBe(15);
    expect(parseNumber("1,000", { decimals: 0, group: "," })).toBe(1000);
  });

  it("reads a minus sign, and tells text that is not a number yet", () => {
    expect(parseNumber("-12,5", hr)).toBe(-12.5);
    expect(parseNumber("-", hr)).toBeUndefined();
    expect(parseNumber("-0", hr)).toBe(0);
  });
});

describe("numberMarks", () => {
  it("reads the separators off the app's formatting", () => {
    expect(numberMarks(createFormatting({ locale: () => "hr-HR" }))).toEqual({ decimal: ",", group: "." });
    expect(numberMarks(createFormatting({ locale: () => "en-US" }))).toEqual({ decimal: ".", group: "," });
  });

  it("honours an app's own number formatter", () => {
    const format = createFormatting({ locale: () => "en", formatters: { number: () => "1 234,5" } });
    expect(numberMarks(format)).toEqual({ decimal: ",", group: "" });
  });
});
