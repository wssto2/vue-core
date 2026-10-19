// `@wssto2/vue-core/eslint`: the generic part of an application's ESLint flat config, and the list of rules that need type
// information. `vue-core lint` (bin/commands/lint.mjs) reads the same list to file each rule under the right baseline section,
// so the config and the driver cannot drift. Everything here needs the optional peers eslint, typescript-eslint,
// eslint-plugin-vue, vue-eslint-parser, @eslint/js and globals.
import js from "@eslint/js";
import type { Linter } from "eslint";
import vue from "eslint-plugin-vue";
import globals from "globals";
import tseslint from "typescript-eslint";
import vueParser from "vue-eslint-parser";

/**
 * The rules that require type information. An explicit list rather than something derived at runtime: the driver once read
 * it back out of the baseline file, which is empty on a first run, so every typed rule was filed under the syntactic section,
 * where the fast path then compared it against a count it never measured.
 */
export const TYPED_RULES: readonly string[] = [
  "@typescript-eslint/await-thenable",
  "@typescript-eslint/no-base-to-string",
  "@typescript-eslint/no-floating-promises",
  "@typescript-eslint/no-misused-promises",
  "@typescript-eslint/no-redundant-type-constituents",
  "@typescript-eslint/no-unnecessary-type-assertion",
  "@typescript-eslint/no-unsafe-argument",
  "@typescript-eslint/no-unsafe-assignment",
  "@typescript-eslint/no-unsafe-call",
  "@typescript-eslint/no-unsafe-enum-comparison",
  "@typescript-eslint/no-unsafe-member-access",
  "@typescript-eslint/no-unsafe-return",
  "@typescript-eslint/prefer-promise-reject-errors",
  "@typescript-eslint/require-await",
  "@typescript-eslint/restrict-plus-operands",
  "@typescript-eslint/restrict-template-expressions",
  "@typescript-eslint/unbound-method",
];

export const TYPED_RULE_SET: ReadonlySet<string> = new Set(TYPED_RULES);

export interface VueCoreConfigOptions {
  /**
   * Turn on the type-aware rules (`TYPED_RULES`, at `warn`: the ratchet counts them). Type-aware linting is slow, so it is
   * opt-in. The application decides how: `typed: process.env.LINT_TYPED === "1"`, the variable `vue-core lint` is run with. Default `false`.
   */
  typed?: boolean;
  /** The folder of the tsconfig the project service reads. Required when `typed`; usually `import.meta.dirname`. */
  tsconfigRootDir?: string;
  /** Ignored in addition to `dist`, `node_modules`, `coverage` and `**\/*.d.ts` (for example the generated code). */
  ignores?: string[];
  /** Your own rule choices; they win over the defaults here, the typed rules included (`{ "…/no-floating-promises": "error" }`). */
  rules?: Linter.RulesRecord;
}

/**
 * The flat config: ESLint, typescript-eslint and Vue recommended sets, browser and Node globals, the Vue template parser on
 * TypeScript, the template-formatting rules off (not enforced without a Prettier pass over templates), and the typed block.
 * Spread it and add your own objects after it:
 * `export default [...vueCoreConfig({ typed, tsconfigRootDir: import.meta.dirname, rules: { … } }), { files: […], rules: … }]`.
 */
export function vueCoreConfig({ typed = false, tsconfigRootDir, ignores = [], rules = {} }: VueCoreConfigOptions = {}): Linter.Config[] {
  if (typed && !tsconfigRootDir) throw new Error("vueCoreConfig: typed linting needs tsconfigRootDir (usually import.meta.dirname)");
  const config: Linter.Config[] = [
    { ignores: ["dist/**", "node_modules/**", "coverage/**", "**/*.d.ts", ...ignores] },
    js.configs.recommended,
    ...(tseslint.configs.recommended as Linter.Config[]),
    ...(vue.configs["flat/recommended"] as Linter.Config[]),
    { files: ["**/*.{js,mjs,ts,vue}"], languageOptions: { globals: { ...globals.browser, ...globals.node } } },
    // `recommended` alone cannot see types, so it misses no-floating-promises (an unawaited call swallows its rejection),
    // no-misused-promises, await-thenable and require-await.
    ...(typed ? (tseslint.configs.recommendedTypeChecked as Linter.Config[]).map((entry) => ({ ...entry, files: ["**/*.{ts,vue}"] })) : []),
    {
      files: ["**/*.vue"],
      languageOptions: {
        parser: vueParser,
        parserOptions: { parser: tseslint.parser, sourceType: "module", extraFileExtensions: [".vue"] },
      },
    },
    ...(typed ? [{ files: ["**/*.{ts,vue}"], languageOptions: { parserOptions: { projectService: true, tsconfigRootDir } } }] : []),
    // Config and tooling files are usually outside tsconfig's `include`: no type information, and without this they fail to parse.
    { files: ["**/*.{js,mjs,cjs}"], ...(tseslint.configs.disableTypeChecked as Linter.Config) },
    {
      files: ["**/*.{ts,vue}"],
      rules: {
        // TypeScript reports undefined references itself, and no-undef cannot see ambient global types.
        "no-undef": "off",
        ...(typed ? Object.fromEntries(TYPED_RULES.map((rule) => [rule, "warn" as const])) : {}),
        // Superseded by @typescript-eslint/no-unused-vars below; the core rule mis-fires on type-only constructs.
        "no-unused-vars": "off",
        "no-useless-assignment": "error",
        "@typescript-eslint/no-empty-object-type": "error",
        "vue/no-ref-as-operand": "error",
        "vue/no-unused-vars": "error",
        "vue/multi-word-component-names": "off",
        // flat/recommended pulls in the template *formatting* rules; the correctness rules of the set stay on.
        "vue/max-attributes-per-line": "off",
        "vue/html-indent": "off",
        "vue/html-closing-bracket-newline": "off",
        "vue/first-attribute-linebreak": "off",
        "vue/singleline-html-element-content-newline": "off",
        "vue/multiline-html-element-content-newline": "off",
        "vue/html-self-closing": "off",
        "vue/attributes-order": "off",
        "vue/no-v-html": "error",
        // `v-model="props.x"` stays an error; shallowOnly lets a controller passed down as a prop expose writable refs.
        "vue/no-mutating-props": ["error", { shallowOnly: true }],
        // `_`-prefixed identifiers are a deliberately unused binding.
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
        ],
        ...rules,
      },
    },
    // Test files (named *.test.ts or in a tests/ folder) define stub components inline, several per file, with untyped prop lists on purpose.
    { files: ["**/*.test.ts", "tests/**/*.{ts,vue}"], languageOptions: { globals: globals.vitest }, rules: { "vue/require-prop-types": "off", "vue/one-component-per-file": "off" } },
  ];
  return config;
}
