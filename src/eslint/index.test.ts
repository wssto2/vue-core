// @vitest-environment node
import { describe, expect, it } from "vitest";
import { TYPED_RULE_SET, TYPED_RULES, vueCoreConfig } from "./index";

const rulesOf = (config: ReturnType<typeof vueCoreConfig>) => Object.assign({}, ...config.map((entry) => entry.rules ?? {})) as Record<string, unknown>;

describe("vueCoreConfig", () => {
  it("is the untyped fast path by default: no typed rule, no project service", () => {
    const config = vueCoreConfig();
    const rules = rulesOf(config);
    expect(TYPED_RULES.filter((rule) => ["warn", "error", 1, 2].includes(rules[rule] as string | number))).toEqual([]);
    expect(config.some((entry) => (entry.languageOptions?.parserOptions as { projectService?: unknown } | undefined)?.projectService === true)).toBe(false);
  });

  it("typed turns every rule of the list on at warn (the ratchet counts them) and wires the project service", () => {
    const config = vueCoreConfig({ typed: true, tsconfigRootDir: "/app" });
    const rules = rulesOf(config);
    for (const rule of TYPED_RULES) expect(rules[rule]).toBe("warn");
    expect(config.some((entry) => (entry.languageOptions?.parserOptions as { tsconfigRootDir?: string } | undefined)?.tsconfigRootDir === "/app")).toBe(true);
    expect(TYPED_RULE_SET.size).toBe(TYPED_RULES.length);
  });

  it("typed without a tsconfigRootDir is refused with the reason", () => {
    expect(() => vueCoreConfig({ typed: true })).toThrow("tsconfigRootDir");
  });

  it("the application's rules win, the typed ones included, and its ignores are added to the defaults", () => {
    const config = vueCoreConfig({ typed: true, tsconfigRootDir: "/app", ignores: ["generated/**"], rules: { "@typescript-eslint/no-floating-promises": "error", "vue/no-v-html": "off" } });
    const rules = rulesOf(config);
    expect(rules["@typescript-eslint/no-floating-promises"]).toBe("error");
    expect(rules["vue/no-v-html"]).toBe("off");
    expect(config[0]?.ignores).toEqual(["dist/**", "node_modules/**", "coverage/**", "**/*.d.ts", "generated/**"]);
  });

  it("gives the test files, in a tests/ folder or named *.test.ts, the vitest globals and the stub-component allowances", () => {
    const entry = vueCoreConfig().find((candidate) => candidate.files?.includes("tests/**/*.{ts,vue}"));
    expect(entry?.files).toEqual(["**/*.test.ts", "tests/**/*.{ts,vue}"]);
    expect(entry?.languageOptions?.globals).toMatchObject({ describe: false, it: false, expect: false, vi: false });
    expect(entry?.rules).toMatchObject({ "vue/require-prop-types": "off", "vue/one-component-per-file": "off" });
  });
});
