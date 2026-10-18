# Keep the feature folders honest

`npx vue-core check-architecture` walks the `.ts` and `.vue` files under the folder of `vue-core.config.mjs` and fails (exit 1) when one breaks a rule. It is plain Node: no build, no `eslint`.

A feature is a folder under `features/` (one or two levels deep) with an `index.ts`. The rules:

| Rule | Reports |
|---|---|
| outside code | an import of a feature other than through `index.ts` or `routes.ts` |
| no feature imports another feature | `@/features/other/...` from inside a feature |
| shared layer | `components/` or `composables/` importing a feature (aliased or relative) |
| generated code | `@/generated/...` outside the allowed subpaths; an old prefix named in `generated.moved` |
| HTTP | `fetch(...)` or `axios` outside an `api.ts` (tests exempt) |
| one `ApiError` | a second `ApiError` class, or `ApiError` imported from anywhere but `@wssto2/vue-core/client` |
| folder names | a folder under `features/` that is not one lowercase word |
| feature shape | a feature with `views/` and no `index.ts` or `routes.ts` (a missing `api.ts` is a warning) |

Two packs are opt-in by name. `design-values` keeps `features/` and `components/` on vue-core's theme (one neutral, the brand green as `primary-*`, no arbitrary shadows or hex colours). `presentation` asks for the library's components in `features/**/*.vue`: `DataTable` or `CollectionTable` instead of `<table>`, the field components instead of `<input>`, `Banner`, `Badge`, `AsyncSection`, column `mobile` roles on a `CollectionTable`. A pack rule's allowlist is a ratchet in both directions: an entry whose file no longer breaks the rule is a violation too.

The section of `vue-core.config.mjs` (every key is optional):

<!-- example: docs/examples/devkit/architecture.config.ts -->
```ts
import { defineConfig } from "@wssto2/vue-core/config";

export default defineConfig({
  architecture: {
    // The defaults: features/, the "@/" alias, components/ and composables/ as the shared layer.
    generated: { allowed: ["entities/*", "schemas/*", "routes/*", "permissions"] },
    packs: ["design-values", "presentation"],
    // Known offenders that predate a rule; the lists only shrink.
    allow: { "feature-name": ["features/old_stuff"] },
    doc: { "shared-layer": "docs/architecture.md, Shared layer" },
    // The application's own rules: the messages for one file, each prefixed with its path.
    rules: [({ content, isTest }) => (!isTest && content.includes("debugger") ? ["no-debugger — remove it"] : [])],
  },
});
```

`allow` is keyed by rule: `deep-import` (`<file> -> <specifier>`), `raw-http`, `feature-name` and `feature-shape` take paths, and a pack rule's id (`no-raw-table`, ...) takes files. A key that names no rule is an error, so a typo cannot silence anything. `doc` appends a reference to a message: `shared-layer`, `api-error` or a pack rule's id. A custom rule gets `{ file, content, template, imports, isVue, isTest }` and runs after the built-in import rules, before the packs.

The `featuresDir`, `alias`, `sharedLayers`, `skip` (folders the walk leaves out) and `uiDirs` (where `design-values` looks) keys move the rules to another layout.
