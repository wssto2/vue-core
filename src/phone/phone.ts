import { AsYouType, getCountries, getCountryCallingCode, parsePhoneNumberFromString, validatePhoneNumberLength, type CountryCode } from "libphonenumber-js/max";
import metadata from "libphonenumber-js/max/metadata";
import { foldText } from "../form/options";

/** An ISO 3166-1 alpha-2 country code ("HR"). */
export type PhoneCountry = CountryCode;

/** The countries listed first in the picker, until the app says otherwise. */
export const COMMON_COUNTRIES: readonly PhoneCountry[] = ["HR", "BA", "SI", "RS"];

/** A phone number as the field holds it: the country the picker shows, the stored E.164 value ("" while there are no digits), and the text of the input. */
export interface PhoneEntry {
  readonly country: PhoneCountry;
  readonly e164: string;
  readonly text: string;
}

const MAX_DIGITS = 15; // E.164

/** The country that owns a calling code: libphonenumber lists the main one first (+1 is US, +44 is GB). */
function mainCountry(calling: string): PhoneCountry | undefined {
  return (metadata.country_calling_codes as Record<string, readonly string[] | undefined>)[calling]?.[0] as PhoneCountry | undefined;
}

const dialCodeOf = (country: PhoneCountry): string => getCountryCallingCode(country);

/** The dial code of a country, with its plus ("+385"). */
export const dialCode = (country: PhoneCountry): string => `+${dialCodeOf(country)}`;

/** Every country a number can belong to. */
export const allCountries = (): readonly PhoneCountry[] => getCountries();

/** The text of a number after its dial code, grouped the way the country writes it: "91 234 5678". */
function groupNational(calling: string, national: string): string {
  const head = `+${calling}`;
  return new AsYouType().input(`${head}${national}`).slice(head.length).trim();
}

function entryFor(country: PhoneCountry, calling: string, digits: string): PhoneEntry {
  const national = digits.slice(0, Math.max(0, MAX_DIGITS - calling.length));
  return national === "" ? { country, e164: "", text: "" } : { country, e164: `+${calling}${national}`, text: groupNational(calling, national) };
}

/**
 * Reads what the user typed, pasted or was given. A number with a plus (or "00") names its own country, so pasting
 * "+387 61 234 567" into a Croatian field switches it to Bosnia and Herzegovina; anything else is a national number of
 * `fallback`, with or without its leading 0. A plus whose dial code is not complete yet is kept as typed (`e164` is "").
 */
export function readPhone(raw: string, fallback: PhoneCountry): PhoneEntry {
  const typed = raw.trim().replace(/^00(?=\d)/, "+");
  if (typed.startsWith("+")) {
    const reading = new AsYouType();
    reading.input(typed);
    const calling = reading.getCallingCode();
    if (!calling) return { country: fallback, e164: "", text: typed.replace(/[^\d+]/g, "") };
    const country = reading.getCountry() ?? (dialCodeOf(fallback) === calling ? fallback : (mainCountry(calling) ?? fallback));
    return entryFor(country, calling, reading.getNumber()?.nationalNumber ?? "");
  }
  const reading = new AsYouType(fallback);
  reading.input(typed.replace(/\D/g, ""));
  return entryFor(fallback, dialCodeOf(fallback), reading.getNumber()?.nationalNumber ?? "");
}

/** The same national digits under another country (the picker changed): "91 234 5678" stays, "+385" becomes "+387". */
export function withCountry(entry: PhoneEntry, country: PhoneCountry): PhoneEntry {
  return entryFor(country, dialCodeOf(country), entry.text.replace(/\D/g, ""));
}

/** The number the way it is written across borders: "+385 91 234 5678". Anything that is not a number is returned as it is. */
export function formatInternational(value: string): string {
  return value.startsWith("+") ? new AsYouType().input(value) : value;
}

/** What the number is, where the metadata can tell. */
export type PhoneKind = "mobile" | "landline" | "toll_free" | "premium_rate" | "voip";

const KINDS: Readonly<Record<string, PhoneKind | undefined>> = { MOBILE: "mobile", FIXED_LINE: "landline", TOLL_FREE: "toll_free", PREMIUM_RATE: "premium_rate", VOIP: "voip" };

/** Mobile, landline, toll-free…: undefined for a number that is not valid, or one the metadata cannot place (a number that may be either). */
export function phoneKind(value: string): PhoneKind | undefined {
  const parsed = value ? parsePhoneNumberFromString(value) : undefined;
  const type = parsed?.isValid() ? parsed.getType() : undefined;
  return type ? KINDS[type] : undefined;
}

/** Why a number is not acceptable. `country` is the one the number belongs to, when it names one. */
export interface PhoneProblem {
  readonly kind: "too_short" | "too_long" | "invalid";
  readonly country: PhoneCountry | undefined;
}

/** The country a stored number belongs to ("+38591234567" is "HR"). */
export function phoneCountry(value: string): PhoneCountry | undefined {
  const reading = new AsYouType();
  reading.input(value);
  const calling = reading.getCallingCode();
  return reading.getCountry() ?? (calling ? mainCountry(calling) : undefined);
}

/**
 * Whether a stored number can be a number of its country: the length first ("too short for Bosnia and Herzegovina"), then
 * the country's own patterns. Empty is not a problem (that is `required`'s). A form's validator calls this, the field shows it.
 */
export function phoneProblem(value: string): PhoneProblem | null {
  if (value === "") return null;
  const country = phoneCountry(value);
  const length = validatePhoneNumberLength(value);
  if (length === "TOO_SHORT") return { kind: "too_short", country };
  if (length === "TOO_LONG") return { kind: "too_long", country };
  if (length !== undefined) return { kind: "invalid", country };
  return parsePhoneNumberFromString(value)?.isValid() ? null : { kind: "invalid", country };
}

/** True when the value is empty or a valid number: for a validator that does not need the reason. */
export const isValidPhone = (value: string): boolean => phoneProblem(value) === null;

/** The country's name in a language ("Bosna i Hercegovina"); the code itself when the browser does not know it. */
export function countryName(country: PhoneCountry, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(country) ?? country;
  } catch {
    return country;
  }
}

/** The countries that match what was typed in the picker: by name, by code ("ba"), or by dial code ("387", "+387"). */
export function searchCountries(query: string, locale: string, countries: readonly PhoneCountry[]): readonly PhoneCountry[] {
  const needle = foldText(query.trim());
  if (needle === "") return countries;
  const digits = needle.replace(/\D/g, "");
  const names = new Intl.DisplayNames([locale], { type: "region" });
  const name = (country: PhoneCountry) => foldText(names.of(country) ?? country);
  const dial = needle.startsWith("+") || /^\d+$/.test(needle);
  return countries.filter((country) => (dial ? dialCodeOf(country).startsWith(digits) : name(country).includes(needle) || country.toLowerCase() === needle));
}
