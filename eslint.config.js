import { vueCoreConfig } from "./src/eslint/index.ts";

// The library lints itself with its own factory (src/eslint). Boundaries of src/ (no `@/`, no stores, nothing outside src/
// and the peers) are checked by scripts/check-src-imports.mjs.
export default [
  ...vueCoreConfig({
    typed: false,
    ignores: ["playground/dist/**", "playground/node_modules/**", "playground/.pack/**", "test-data/go-core/*/**", ".claude/**"],
    rules: { "@typescript-eslint/no-explicit-any": "error", "vue/require-default-prop": "error" },
  }),
  {
    // The library has no business with app stores or app globals; the script is the
    // authority for src/, this keeps the editor honest too.
    files: ["src/**/*.{ts,vue}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [
        { group: ["@/*"], message: "No app alias inside the library: use relative imports (PLAN.md rule 3)." },
        { group: ["pinia", "pinia/*"], message: "No stores in the library (PLAN.md rules 3 and 5)." },
      ] }],
    },
  },
];
