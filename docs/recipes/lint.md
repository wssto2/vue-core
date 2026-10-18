# Recipe: lint with ceilings that only go down

`vue-core lint` runs ESLint once and enforces two things: an `error` fails the run, and every `warn` is counted per file and per rule against a baseline file. A count over its ceiling fails ("NEW violation", with the offending lines), and a count under it fails too ("lock it in"), so the ceilings only go down. Use it to turn a rule on today and pay its existing violations down later, instead of "later, in its own pull request".

`eslint`, `typescript-eslint`, `eslint-plugin-vue`, `vue-eslint-parser`, `@eslint/js` and `globals` are optional peers; install them in the application that lints.

## The ESLint config

`@wssto2/vue-core/eslint` returns the generic part of a flat config: the recommended sets, the Vue template parser on TypeScript, the template formatting rules off, the typed block, and `TYPED_RULES`, the list of rules that need type information (the driver files them under their own baseline section, so the config and the driver cannot drift). Your rule choices go in `rules`, and any config object after the spread.

```js
// eslint.config.js
import { vueCoreConfig } from "@wssto2/vue-core/eslint";

export default [
  ...vueCoreConfig({
    typed: process.env.LINT_TYPED === "1", // type-aware rules, at `warn`: the ratchet counts them
    tsconfigRootDir: import.meta.dirname, // required when typed
    ignores: ["generated/**"], // on top of dist, node_modules, coverage and *.d.ts
    rules: { "@typescript-eslint/no-explicit-any": "warn", "vue/require-default-prop": "warn" }, // `warn` = counted, `error` = zero
  }),
  { files: ["tests/**/*.ts"], rules: { "vue/one-component-per-file": "off" } },
];
```

Type-aware linting costs about 1.5 s per file, so it is opt-in: `LINT_TYPED=1` lints the files the branch changed (and uncommitted work), measured from `LINT_BASE`, else `GITHUB_BASE_REF` (`origin/<it>`), else the upstream, else the nearest of `origin/main`, `main`, `origin/dev`, `dev`, `origin/master`, `master`. With no base (a shallow clone) it lints everything, so give CI the full history.

## The command

```bash
npx vue-core lint                       # untyped, whole tree: errors at zero, warnings at their ceilings
npx vue-core lint --fix                 # autofix, then enforce
npx vue-core lint --update              # rewrite the ceilings from this run
LINT_TYPED=1 npx vue-core lint          # typed, changed files
LINT_TYPED=1 npx vue-core lint --file=components/Gallery   # typed, every file whose path contains it
LINT_TYPED=1 npx vue-core lint --update --all              # reseed the typed section from the whole tree
npx vue-core lint --report --summary    # the grandfathered debt: rankings only (also --rule=<text>, --file=<text>)
```

The untyped whole-tree run judges the `syntacticByFile` and `patternByFile` sections; a typed run judges `typedByFile`, for the files it linted only. `--update` rewrites the entries of the files in scope from what was measured: a lowered count is written, a file at zero or no longer there drops out, files outside the scope keep their ceilings. A first `--update` creates the baseline file with a header. Raising a ceiling is a decision for your reviewers, not a flag.

The section of `vue-core.config.mjs`:

<!-- example: docs/examples/devkit/lint-config.ts -->
```ts
import { defineConfig } from "@wssto2/vue-core/config";

// The `lint` section of vue-core.config.mjs. Every key is optional.
export default defineConfig({
  lint: {
    baselines: "scripts/lint-baselines.json",
    generated: ["generated"],
    // Debt ESLint cannot count itself: an inline disable is invisible to the rule it silences.
    patternCounters: [
      {
        name: "vue/no-v-html disable directives",
        extensions: [".vue", ".ts"],
        pattern: /eslint-disable(?:-next-line)?[^\n]*vue\/no-v-html/g,
        hint: "each disable needs an audited justification",
      },
    ],
    // What the messages tell the developer to run, when the application wraps the command in npm scripts.
    commands: { update: "npm run lint:update-baselines", typedUpdate: "npm run lint:typed:update" },
    policy: "documentation/rules.md",
  },
});
```

The command runs from the folder of `vue-core.config.mjs`, which is also the root of the baseline path, the scanned tree and the typed scope; in a monorepo the folder's path inside the repository is taken from git (`git rev-parse --show-prefix`).
