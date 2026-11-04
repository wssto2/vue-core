import { afterEach, describe, expect, it, vi } from "vitest";
import { playwrightConfig } from "./config";

afterEach(() => vi.unstubAllEnvs());

describe("playwrightConfig", () => {
  it("is the local shape: html reporter, no retries, the default port, the timings report", () => {
    vi.stubEnv("CI", "");
    vi.stubEnv("E2E_PORT", "");
    const config = playwrightConfig();
    expect(config).toMatchObject({ testDir: "./e2e", testIgnore: [], outputDir: "./e2e-results", fullyParallel: true, forbidOnly: false, retries: 0, workers: undefined });
    expect(config.reporter).toEqual([["html"], ["json", { outputFile: "e2e-timings/results.json" }]]);
    expect(config.use).toEqual({ baseURL: "http://127.0.0.1:5173", trace: "on-first-retry" });
    expect(config.webServer).toEqual({ command: "npm run dev -- --port 5173", url: "http://127.0.0.1:5173", reuseExistingServer: true, timeout: 30_000 });
    expect(config.projects).toHaveLength(1);
    expect(config.projects?.[0]).toMatchObject({ name: "chromium", use: { defaultBrowserType: "chromium" } });
  });

  it("is stricter in CI: forbidOnly, two retries, two workers, the github reporter, a fresh server", () => {
    vi.stubEnv("CI", "1");
    const config = playwrightConfig();
    expect(config).toMatchObject({ forbidOnly: true, retries: 2, workers: 2 });
    expect(config.reporter).toEqual([["github"], ["json", { outputFile: "e2e-timings/results.json" }]]);
    expect((config.webServer as { reuseExistingServer: boolean }).reuseExistingServer).toBe(false);
  });

  it("takes the port from E2E_PORT before the option, and pins the timezone for specs and browser", () => {
    vi.stubEnv("CI", "");
    vi.stubEnv("TZ", "UTC");
    vi.stubEnv("E2E_PORT", "5300");
    const config = playwrightConfig({ port: 4000, timezone: "Europe/Zagreb", testDir: "./specs", ignore: ["**/capture.spec.ts"], report: "out/r.json" });
    expect(process.env.TZ).toBe("Europe/Zagreb");
    expect(config).toMatchObject({ testDir: "./specs", testIgnore: ["**/capture.spec.ts"] });
    expect(config.use).toMatchObject({ baseURL: "http://127.0.0.1:5300", timezoneId: "Europe/Zagreb" });
    expect((config.webServer as { command: string }).command).toBe("npm run dev -- --port 5300");
    expect(config.reporter).toEqual([["html"], ["json", { outputFile: "out/r.json" }]]);
    vi.stubEnv("E2E_PORT", "");
    expect(playwrightConfig({ port: 4000 }).use).toMatchObject({ baseURL: "http://127.0.0.1:4000" });
  });

  it("lets every field be overridden, merging use and webServer one level deep", () => {
    vi.stubEnv("CI", "");
    const config = playwrightConfig({}, { retries: 1, timeout: 5000, use: { trace: "on" }, webServer: { reuseExistingServer: false } });
    expect(config).toMatchObject({ retries: 1, timeout: 5000 });
    expect(config.use).toEqual({ baseURL: "http://127.0.0.1:5173", trace: "on" });
    expect(config.webServer).toMatchObject({ command: "npm run dev -- --port 5173", reuseExistingServer: false });
  });
});
