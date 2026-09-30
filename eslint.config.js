import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import vue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";

// Adapted from arv-next's config: the TypeScript and Vue rules, without the ARV
// baselines, typed-lint ratchet and architecture scripts. Boundaries of src/ (no `@/`,
// no stores, nothing outside src/ and the peers) are checked by scripts/check-src-imports.mjs.
export default [
  { ignores: ["dist/**", "node_modules/**", "coverage/**", "playground/dist/**", "playground/node_modules/**", "playground/.pack/**", "**/*.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs["flat/recommended"],
  {
    files: ["**/*.{js,mjs,ts,vue}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tseslint.parser, sourceType: "module", extraFileExtensions: [".vue"] },
    },
  },
  {
    files: ["**/*.{ts,vue}"],
    rules: {
      // TypeScript reports undefined references itself; no-undef cannot see ambient types.
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-useless-assignment": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-empty-object-type": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
      "vue/no-ref-as-operand": "error",
      "vue/no-unused-vars": "error",
      "vue/no-v-html": "error",
      "vue/no-mutating-props": ["error", { shallowOnly: true }],
      "vue/require-default-prop": "error",
      "vue/multi-word-component-names": "off",
      // Template formatting is not enforced (no Prettier pass over templates); the
      // correctness rules of flat/recommended stay on.
      "vue/max-attributes-per-line": "off",
      "vue/html-indent": "off",
      "vue/html-closing-bracket-newline": "off",
      "vue/first-attribute-linebreak": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/multiline-html-element-content-newline": "off",
      "vue/html-self-closing": "off",
      "vue/attributes-order": "off",
    },
  },
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
  {
    files: ["**/*.test.ts"],
    languageOptions: { globals: globals.vitest },
    rules: { "vue/require-prop-types": "off", "vue/one-component-per-file": "off" },
  },
];
