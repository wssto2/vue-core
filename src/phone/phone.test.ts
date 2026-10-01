import { describe, expect, it } from "vitest";
import { allCountries, countryName, dialCode, formatInternational, isValidPhone, phoneCountry, phoneKind, phoneProblem, readPhone, searchCountries, withCountry } from "./phone";

describe("reading a number", () => {
  it.each([
    ["HR", "091 234 5678", "+385912345678", "91 234 5678"],
    ["HR", "0912345678", "+385912345678", "91 234 5678"],
    ["HR", "912345678", "+385912345678", "91 234 5678"],
    ["BA", "061 234 567", "+38761234567", "61 234 567"],
    ["BA", "033 445 566", "+38733445566", "33 445 566"],
    ["SI", "041 123 456", "+38641123456", "41 123 456"],
    ["RS", "060 1234567", "+381601234567", "60 1234567"],
  ] as const)("%s: %s is %s", (country, typed, e164, text) => {
    expect(readPhone(typed, country)).toEqual({ country, e164, text });
  });

  it("a number with a plus names its own country, wherever the field was", () => {
    expect(readPhone("+387 61 234 567", "HR")).toEqual({ country: "BA", e164: "+38761234567", text: "61 234 567" });
    expect(readPhone("0038761234567", "HR")).toEqual({ country: "BA", e164: "+38761234567", text: "61 234 567" });
    expect(readPhone("+385 91 234 5678", "BA").country).toBe("HR");
  });

  it("an international number of another region keeps its own grouping", () => {
    expect(readPhone("+49 30 901820", "HR")).toEqual({ country: "DE", e164: "+4930901820", text: "30 901820" });
    expect(readPhone("+1 (415) 555-2671", "HR")).toEqual({ country: "US", e164: "+14155552671", text: "415 555 2671" });
    expect(readPhone("+44 20 7183 8750", "HR").country).toBe("GB");
  });

  it("a dial code shared by several countries goes to the main one, or keeps the field's country", () => {
    expect(readPhone("+1", "HR").country).toBe("US");
    expect(readPhone("+1", "CA").country).toBe("CA");
  });

  it("keeps a plus whose dial code is not complete, and stores nothing yet", () => {
    expect(readPhone("+3", "HR")).toEqual({ country: "HR", e164: "", text: "+3" });
    expect(readPhone("+", "HR").e164).toBe("");
  });

  it("formats as it goes, and drops letters and punctuation", () => {
    expect(readPhone("9", "HR").text).toBe("9");
    expect(readPhone("91 23", "HR").text).toBe("91 23");
    expect(readPhone("(091) 234-5678 ext", "HR").e164).toBe("+385912345678");
    expect(readPhone("", "HR")).toEqual({ country: "HR", e164: "", text: "" });
  });

  it("never stores more digits than E.164 allows", () => {
    expect(readPhone("9".repeat(30), "HR").e164).toHaveLength(16);
  });

  it("moves the same digits to another country", () => {
    expect(withCountry(readPhone("091 234 567", "HR"), "BA")).toEqual({ country: "BA", e164: "+38791234567", text: "91 234 567" });
    expect(withCountry(readPhone("", "HR"), "BA")).toEqual({ country: "BA", e164: "", text: "" });
  });

  it("writes a stored number across borders", () => {
    expect(formatInternational("+385912345678")).toBe("+385 91 234 5678");
    expect(formatInternational("+38733445566")).toBe("+387 33 445 566");
    expect(formatInternational("091 234")).toBe("091 234");
  });
});

describe("what is wrong with a number", () => {
  it("says too short, too long and not a number of the country, by country", () => {
    expect(phoneProblem("+38733445")).toEqual({ kind: "too_short", country: "BA" });
    expect(phoneProblem("+3873344556677")).toEqual({ kind: "too_long", country: "BA" });
    expect(phoneProblem("+38760123456")).toEqual({ kind: "invalid", country: "BA" });
    expect(phoneProblem("+385")).toEqual({ kind: "too_short", country: "HR" });
  });

  it("accepts the numbers of HR, BA, SI, RS and abroad, and an empty one", () => {
    for (const number of ["+385912345678", "+38761234567", "+38733445566", "+38641123456", "+381601234567", "+381112345678", "+4930901820", "+14155552671"]) expect(phoneProblem(number), number).toBeNull();
    expect(phoneProblem("")).toBeNull();
    expect(isValidPhone("")).toBe(true);
    expect(isValidPhone("+38733445")).toBe(false);
  });

  it("names the country of a stored number", () => {
    expect(phoneCountry("+38591234567")).toBe("HR");
    expect(phoneCountry("+14155552671")).toBe("US");
    expect(phoneCountry("+1")).toBe("US");
    expect(phoneCountry("12345")).toBeUndefined();
  });

  it("tells mobile from landline where the metadata can", () => {
    expect(phoneKind("+385912345678")).toBe("mobile");
    expect(phoneKind("+38761234567")).toBe("mobile");
    expect(phoneKind("+38733445566")).toBe("landline");
    expect(phoneKind("+381112345678")).toBe("landline");
    expect(phoneKind("+385800123456")).toBe("toll_free");
    expect(phoneKind("+14155552671")).toBeUndefined(); // US numbers may be either
    expect(phoneKind("+38733445")).toBeUndefined();
    expect(phoneKind("")).toBeUndefined();
  });
});

describe("countries", () => {
  it("lists every country with its dial code and a name in the language", () => {
    expect(allCountries().length).toBeGreaterThan(200);
    expect(dialCode("BA")).toBe("+387");
    expect(countryName("BA", "en")).toBe("Bosnia & Herzegovina");
    expect(countryName("HR", "hr")).toBe("Hrvatska");
  });

  it("searches by name (no case, no accents), by code and by dial code", () => {
    const all = allCountries();
    expect(searchCountries("hrv", "hr", all)).toEqual(["HR"]);
    expect(searchCountries("CRO", "en", all)).toContain("HR");
    expect(searchCountries("ba", "en", all)).toContain("BA");
    expect(searchCountries("387", "en", all)).toEqual(["BA"]);
    expect(searchCountries("+38", "en", all)).toEqual(expect.arrayContaining(["HR", "BA", "SI", "RS"]));
    expect(searchCountries("", "en", all)).toBe(all);
    expect(searchCountries("zzzz", "en", all)).toEqual([]);
  });
});
