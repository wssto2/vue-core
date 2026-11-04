import { afterEach, describe, expect, it, vi } from "vitest";
import { vitestDefaults } from "./index";

afterEach(() => vi.unstubAllEnvs());

describe("vitestDefaults", () => {
  it("is globals, happy-dom, the Playwright folders excluded and no setup file", () => {
    expect(vitestDefaults()).toEqual({ globals: true, environment: "happy-dom", exclude: ["**/node_modules/**", "**/dist/**", "e2e/**", "review/**"], setupFiles: [] });
  });

  it("pins TZ and takes the setup files; without a timezone TZ is left alone", () => {
    vi.stubEnv("TZ", "UTC");
    expect(vitestDefaults({ setupFiles: ["./tests/setup.ts"] }).setupFiles).toEqual(["./tests/setup.ts"]);
    expect(process.env.TZ).toBe("UTC");
    vitestDefaults({ timezone: "Europe/Zagreb" });
    expect(process.env.TZ).toBe("Europe/Zagreb");
    expect(new Date(2026, 2, 29, 12).getTimezoneOffset()).toBe(-120); // Zagreb in summer time
  });
});
