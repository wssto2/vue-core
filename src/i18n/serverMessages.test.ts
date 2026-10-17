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
