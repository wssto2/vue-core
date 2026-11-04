import vue from "@vitejs/plugin-vue";
import { vitestDefaults } from "@wssto2/vue-core/config";
import { defineConfig } from "vitest/config";

// What the tests need from the application's build setup: Vue's compiler for `.vue` files and a DOM.
// `@wssto2/vue-core/testing` brings no test runner and no testing library: install vitest, happy-dom and
// @testing-library/vue (or @vue/test-utils) yourself. `vitestDefaults` is the rest: globals, happy-dom, the
// Playwright folders left out, and the zone the markets run in.
export default defineConfig({
  plugins: [vue()],
  test: vitestDefaults({ timezone: "Europe/Zagreb", setupFiles: ["./tests/setup.ts"] }),
});
