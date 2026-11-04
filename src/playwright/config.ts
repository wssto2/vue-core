import { devices, type PlaywrightTestConfig } from "@playwright/test";

// Node-only (a config file runs in Node); the build compiles without @types/node, so declare the one global used.
declare const process: { env: Record<string, string | undefined> };

/** Any Playwright config field; `webServer` is the one server this preset starts, so a part of it is enough. */
export type PlaywrightOverrides = Omit<PlaywrightTestConfig, "webServer"> & {
  webServer?: { command?: string; url?: string; port?: number; reuseExistingServer?: boolean; timeout?: number; cwd?: string; env?: Record<string, string> };
};

export interface PlaywrightConfigOptions {
  /** Where the specs live, relative to the config file. Default `"./e2e"`. */
  testDir?: string;
  /** The zone the specs and the browser run in (specs build expected times with local Dates, and a CI runner is UTC). Sets `TZ` and `timezoneId`; unset leaves both alone. */
  timezone?: string;
  /** Spec globs to leave out (opt-in screenshot specs). Default none. */
  ignore?: string[];
  /** The dev server's port when `E2E_PORT` is not set, which runs a second checkout's suite on its own server. Default 5173. */
  port?: number;
  /** The JSON report `vue-core e2e-timings` reads (`e2eTimings.report`). Default `"e2e-timings/results.json"`. */
  report?: string;
}

/**
 * The Playwright config of an application on vue-core: its dev server (`npm run dev -- --port`, reused when one runs outside CI), Chromium,
 * fully parallel specs, and in CI `forbidOnly`, two retries and two workers, the `github` reporter instead of `html`, plus the JSON report
 * `vue-core e2e-timings` reads. `overrides` replaces any field; `use` and `webServer` merge one level deep.
 *
 *   export default playwrightConfig({ timezone: "Europe/Zagreb" });
 */
export function playwrightConfig(options: PlaywrightConfigOptions = {}, overrides: PlaywrightOverrides = {}): PlaywrightTestConfig {
  const port = Number(process.env.E2E_PORT || options.port || 5173);
  const baseURL = `http://127.0.0.1:${port}`;
  const ci = !!process.env.CI;
  if (options.timezone) process.env.TZ = options.timezone; // workers inherit it
  const { use, webServer, ...rest } = overrides;
  return {
    testDir: options.testDir ?? "./e2e",
    testIgnore: options.ignore ?? [],
    outputDir: "./e2e-results",
    fullyParallel: true,
    forbidOnly: ci,
    retries: ci ? 2 : 0,
    workers: ci ? 2 : undefined,
    reporter: [[ci ? "github" : "html"], ["json", { outputFile: options.report ?? "e2e-timings/results.json" }]],
    use: { baseURL, ...(options.timezone ? { timezoneId: options.timezone } : {}), trace: "on-first-retry", ...use },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: { command: `npm run dev -- --port ${port}`, url: baseURL, reuseExistingServer: !ci, timeout: 30_000, ...webServer },
    ...rest,
  };
}
