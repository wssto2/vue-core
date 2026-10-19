import { describe, expect, it } from "vitest";
import { ApiError, type ApiErrorInit } from "../client";
import { createTestApp, withSetup } from "../testing";
import { useServerMessages } from "./serverMessages";

const refused = (init: Partial<ApiErrorInit> = {}) => new ApiError({ message: "log text", kind: "rejected", status: 403, code: "app.owns_leads", ...init });
const messages = () => {
  const app = createTestApp({ messages: { en: { errors: { app: { owns_leads: "They still own leads." } }, core: { errors: { app: { locked: "Locked until {locked_until}." } } } } } });
  return withSetup(() => useServerMessages(), app).result;
};

describe("useServerMessages", () => {
  it("words a field's reason with the app's errors.<reason> or the library's core.errors.<reason>, and leaves other text as it is", () => {
    const { describeFieldError } = messages();
    expect(describeFieldError("app.owns_leads")).toBe("They still own leads.");
    expect(describeFieldError("identity.email.taken")).toBe("This e-mail address is already used by another account.");
    expect(describeFieldError("Too short")).toBe("Too short");
  });

  it("says a refusal's reason for a failed, forbidden or conflicting action, and nothing for a field error or a network failure", () => {
    const { failureMessage } = messages();
    expect(failureMessage("failed", refused())).toBe("They still own leads.");
    expect(failureMessage("forbidden", refused())).toBe("They still own leads.");
    expect(failureMessage("conflict", refused({ status: 409 }))).toBe("They still own leads.");
    expect(failureMessage("invalid", refused({ kind: "validation", status: 422 }))).toBeUndefined();
    expect(failureMessage("failed", new Error("x"))).toBeUndefined();
    expect(failureMessage("failed", refused({ code: undefined }))).toBeUndefined();
  });

  it("reads the time a lock ends as a time of day", () => {
    const { sentence } = messages();
    const text = sentence(refused({ code: "app.locked", params: { locked_until: "2026-10-03T14:35:00Z" } }));
    expect(text).toMatch(/^Locked until .*\d.*\.$/);
    expect(text).not.toContain("2026-10-03T14:35:00Z");
  });
});

describe("useServerMessages({ prefixes })", () => {
  const withMessages = (en: object, options?: Parameters<typeof useServerMessages>[0]) => withSetup(() => useServerMessages(options), createTestApp({ messages: { en } })).result;

  it("says a validator's key (validation_errors.<rule>) with the app's text, else the library's", () => {
    const { describeFieldError } = withMessages({ validation_errors: { required: "Fill this in." } });
    expect(describeFieldError("validation_errors.required")).toBe("Fill this in.");
    expect(describeFieldError("validation_errors.email")).toBe("Enter a valid email address.");
    expect(describeFieldError("validation_errors.no_such_rule")).toBe("validation_errors.no_such_rule");
  });

  it("reads a rule that needs a parameter the server did not send as a range message", () => {
    const { describeFieldError } = withMessages({});
    for (const rule of ["min", "max", "min_value", "max_value", "between", "in", "not_in"]) expect(describeFieldError(`validation_errors.${rule}`)).toBe("The value is not within the allowed range.");
    expect(withMessages({ validation_errors: { out_of_range: "Out." } }).describeFieldError("validation_errors.min")).toBe("Out.");
  });

  it("takes the prefixes it is given, and none leaves every key as sent", () => {
    expect(withMessages({ rules: { required: "Needed." } }, { prefixes: ["rules"] }).describeFieldError("rules.required")).toBe("Needed.");
    expect(withMessages({}, { prefixes: [] }).describeFieldError("validation_errors.required")).toBe("validation_errors.required");
  });
});

