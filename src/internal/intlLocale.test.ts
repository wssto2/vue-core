import { afterEach, describe, expect, it, vi } from "vitest";
import { createFormatting } from "../format";
import { countryName } from "../phone/phone";
import { intlLocale } from "./intlLocale";

afterEach(() => vi.restoreAllMocks());

describe("intlLocale", () => {
  it("stands Bosnian in for Chromium, which has no `bs` data, and leaves every other locale alone", () => {
    expect(intlLocale("bs")).toBe("sr-Latn-BA");
    for (const locale of ["en", "hr", "sl", "sr-Latn", "de"]) expect(intlLocale(locale)).toBe(locale);
  });

  it("is what the formatters and the country names hand to Intl", () => {
    const number = vi.spyOn(Intl, "NumberFormat");
    const names = vi.spyOn(Intl, "DisplayNames");
    const format = createFormatting({ locale: () => "bs" });
    format.number(1234.5);
    format.money(1, "BAM");
    countryName("DE", "bs");
    expect(number.mock.calls.map(([locale]) => locale)).toEqual(["sr-Latn-BA", "sr-Latn-BA"]);
    expect(names.mock.calls[0]![0]).toEqual(["sr-Latn-BA"]);
  });
});
