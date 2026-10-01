import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

// What the tests need from the application's build setup: Vue's compiler for `.vue` files and a DOM.
// `@wssto2/vue-core/testing` brings no test runner and no testing library: install vitest and
// @testing-library/vue (or @vue/test-utils) yourself.
export default defineConfig({
  plugins: [vue()],
  test: { environment: "happy-dom" },
});
