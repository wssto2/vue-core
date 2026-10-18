import { defineConfig } from "@wssto2/vue-core/config";

export default defineConfig({
  generator: {
    template: "templates/feature-crud", // default: the template shipped with vue-core
    out: "features", // where `vue-core feature a/b` makes the folder
  },
  e2eTimings: {
    report: "e2e-timings/results.json", // the file Playwright's `json` reporter writes
  },
});
