import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createApplication } from "../app/application";
import { createFormatting } from "../format";
import { fakeBackend, options } from "../app/testing";
import { zodErrorMap } from "./zodErrorMap";

// The map answers with the key it looked up and the params, so each row of the table is "this Zod issue -> this text key, these params".
function mapOf(keys: readonly string[], numberSymbols = { group: ".", decimal: "," }) {
  const format = createFormatting({ locale: () => "en", numberSymbols });
  const environment = {
    i18n: { global: { t: (key: string, params?: Record<string, unknown>) => `${key}${params ? JSON.stringify(params) : ""}`, te: (key: string) => keys.includes(key) } },
    format,
  };
  return (issue: Record<string, unknown>) => zodErrorMap(environment)(issue as never);
}
const app = ["validation_errors.deadline_before_opening"];
const map = mapOf(app);

describe("zodErrorMap: every branch of Zod's issues", () => {
  it.each<[string, Record<string, unknown>, string | undefined]>([
    ["invalid_type", { code: "invalid_type", expected: "string" }, "core.validation_errors.required"],
    ["string too short, min 1", { code: "too_small", origin: "string", minimum: 1 }, "core.validation_errors.required"],
    ["string too short", { code: "too_small", origin: "string", minimum: 3 }, 'core.validation_errors.min{"min":3}'],
    ["number too small, whole", { code: "too_small", origin: "number", minimum: 5 }, 'core.validation_errors.min_value{"min":"5"}'],
    ["number too small, a year stays 2100", { code: "too_small", origin: "number", minimum: 2100 }, 'core.validation_errors.min_value{"min":"2100"}'],
    ["number too small, grouped from 10000", { code: "too_small", origin: "number", minimum: 9_999_999 }, 'core.validation_errors.min_value{"min":"9.999.999"}'],
    ["number too small, negative", { code: "too_small", origin: "number", minimum: -12_000 }, 'core.validation_errors.min_value{"min":"-12.000"}'],
    ["number too small, fractional", { code: "too_small", origin: "number", minimum: 0.5 }, 'core.validation_errors.min_value{"min":"0,50"}'],
    ["string too long", { code: "too_big", origin: "string", maximum: 255 }, 'core.validation_errors.max{"max":255}'],
    ["number too big", { code: "too_big", origin: "number", maximum: 100_000 }, 'core.validation_errors.max_value{"max":"100.000"}'],
    ["email", { code: "invalid_format", format: "email" }, "core.validation_errors.email"],
    ["url", { code: "invalid_format", format: "url" }, "core.validation_errors.url"],
    ["date", { code: "invalid_format", format: "date" }, "core.validation_errors.date"],
    ["datetime", { code: "invalid_format", format: "datetime" }, "core.validation_errors.datetime"],
    ["a format without a text", { code: "invalid_format", format: "uuid" }, undefined],
    ["an array too small", { code: "too_small", origin: "array", minimum: 1 }, undefined],
    ["a date too big", { code: "too_big", origin: "date", maximum: 1 }, undefined],
    ["custom required (a generated zero-is-missing refine)", { code: "custom", params: { code: "required" } }, "core.validation_errors.required"],
    ["custom code the app has a text for", { code: "custom", params: { code: "deadline_before_opening" } }, "validation_errors.deadline_before_opening"],
    ["custom code nobody has a text for", { code: "custom", params: { code: "unknown_rule" } }, undefined],
    ["custom without a code", { code: "custom" }, undefined],
    ["custom with a code that is not a string", { code: "custom", params: { code: 7 } }, undefined],
    ["any other code", { code: "invalid_value", values: ["a"] }, undefined],
  ])("%s", (_name, issue, key) => {
    expect(map(issue)).toEqual(key === undefined ? undefined : { message: key });
  });

  it("prefers the application's own validation_errors text over the library's for the same key", () => {
    const own = mapOf(["validation_errors.required", "validation_errors.min", "validation_errors.max_value"]);
    expect(own({ code: "invalid_type" })).toEqual({ message: "validation_errors.required" });
    expect(own({ code: "too_small", origin: "string", minimum: 2 })).toEqual({ message: 'validation_errors.min{"min":2}' });
    expect(own({ code: "too_big", origin: "number", maximum: 20_000 })).toEqual({ message: 'validation_errors.max_value{"max":"20.000"}' });
    expect(own({ code: "invalid_format", format: "email" })).toEqual({ message: "core.validation_errors.email" });
  });

  it("writes a bound with the application's number symbols", () => {
    const english = mapOf([], { group: ",", decimal: "." });
    expect(english({ code: "too_big", origin: "number", maximum: 1_250_000.5 })).toEqual({ message: 'core.validation_errors.max_value{"max":"1,250,000.50"}' });
  });
});

describe("zodErrorMap: on a real application", () => {
  it("replaces Zod's English with the library's texts in the active language", () => {
    const application = createApplication(options(fakeBackend().platform, []));
    const previous = z.config().customError;
    z.config({ customError: zodErrorMap(application) });
    try {
      const messages = (schema: z.ZodType, value: unknown) => schema.safeParse(value).error?.issues.map((issue) => issue.message);
      expect(messages(z.string().min(1), "")).toEqual(["Required."]);
      expect(messages(z.string().email(), "nope")).toEqual(["Enter a valid email address."]);
      expect(messages(z.number().max(9_999_999), 10_000_000)).toEqual(["The value must be at most 9,999,999."]);
      expect(messages(z.string().min(1, "Mine"), "")).toEqual(["Mine"]); // a message the schema carries wins
      expect(messages(z.enum(["a"]), "b")?.[0]).toMatch(/expected/); // no text of ours: Zod's own
    } finally {
      z.config({ customError: previous });
      application.dispose();
    }
  });
});
