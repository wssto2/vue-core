import { playwrightConfig } from "@wssto2/vue-core/playwright";

// Review captures are opt-in: screenshot-only specs run only with CAPTURE=1.
const CAPTURE = process.env.CAPTURE === "1";

// Specs in ./e2e, on their own dev server (`E2E_PORT` moves it when a second checkout holds 5173), Chromium, and the zone the
// markets run in, for the specs and the browser. The JSON timings report is where `vue-core e2e-timings` reads it.
export default playwrightConfig({
  timezone: "Europe/Zagreb",
  ignore: CAPTURE ? [] : ["**/screens.spec.ts"],
});
