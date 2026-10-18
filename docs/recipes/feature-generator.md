# Recipe: scaffolding a feature, and the e2e timings

## `vue-core feature`

```bash
npx vue-core feature administration/example-reports --entity ExampleReport
```

Makes `features/administration/example-reports/` from go-core's route table for the Go feature (`ts:generate-routes`, folder `examplereports`, table `examplereportsRoutes`): `api.ts` (the requests and the list definition), `form.ts` (the generated input schema), `types.ts`, `index.ts`, `routes.ts`, `views/Index.vue` (a `CollectionPage`), `components/ExampleReportModal.vue` (the create dialog) and `tests/scaffold.test.ts`. It refuses a folder that exists. `--feature <path>` is the same as the first argument.

The default template imports vue-core's subpaths and the generated route table (`@/generated/routes/<feature>/…`) and expects the Go entity to have `id`, `name`, `created_at` and `updated_at`. An application with its own conventions points `generator.template` at its own folder of `*.tpl` files; `__FEATURE_ENTITY__`, `__FEATURE_PATH__`, `__FEATURE_API_CLIENT__`, `__FEATURE_LIST__`, `__FEATURE_ROUTE_TABLE__`, `__FEATURE_ROUTE_MODULE__`, `__FEATURE_I18N_MODULE__` and the rest of the names in `buildFeatureContext` (bin/commands/feature.mjs) are replaced in the files and in their names.

## `vue-core e2e-timings`

```bash
npx vue-core e2e-timings --top 20
```

Prints the slowest spec files and tests of Playwright's JSON report: add `["json", { outputFile: "e2e-timings/results.json" }]` to `reporter`. `--report <path>` reads another file; `e2eTimings.report` sets the default.

<!-- example: docs/examples/devkit/generator.config.ts -->
```ts
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
```
