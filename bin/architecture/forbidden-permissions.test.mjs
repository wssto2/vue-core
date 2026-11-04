// `forbidden` (arv-next's account-type rule as data) and `permission-texts` (arv-next's Go "translations" check), planted violations and allowed cases.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULTS } from "../config.mjs";
import { check } from "./engine.mjs";
import { generatedIds } from "./permissions.mjs";

const cache = join(process.cwd(), "node_modules", ".cache", "architecture");
mkdirSync(cache, { recursive: true });
function tree(files) {
  const dir = mkdtempSync(join(cache, "forbidden-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}
const base = { ...DEFAULTS.architecture, generated: { dir: "generated", allowed: [], moved: {} }, uiDirs: ["features", "components"] };

// arv-next's frontend/vue-core.config.mjs rule 8
const ACCOUNT_TYPE_BRANCH =
  /\b(account_type_id|account_role_id|accountTypeId)\b|(?<![\w.])(?:policies\.|access\.)?(webmaster|masterAdmin|dealerAdmin|dealerUser|isStaffAccount)\s*\(/;
const accountType = { id: "no-account-type-branching", pattern: ACCOUNT_TYPE_BRANCH, message: "use a permission, a scope or a qualifier" };

describe("forbidden", () => {
  const files = {
    "features/a/index.ts": "export const a = 1;",
    "features/a/routes.ts": "export const routes = [];",
    "features/a/bad.ts": "const x = 1;\nif (user.accountTypeId === 3) go();\n",
    "features/a/bad2.vue": "<script setup lang=\"ts\">\nif (access.webmaster()) go();\n</script>\n<template><p /></template>",
    "features/a/comment.ts": "// accountTypeId is gone\n/* webmaster() */\nexport const ok = 1;\n",
    "features/a/url.ts": 'export const u = "https://x.test/a"; // accountTypeId\n',
    "features/a/bad.test.ts": "const x = accountTypeId;\n",
    "e2e/f.ts": "const x = accountTypeId;\n",
    "docs/f.ts": "const x = webmaster();\n",
    "scripts/f.ts": "const x = webmaster();\n",
  };

  it("reports the first matching line with the message, outside comments, tests, e2e, docs and scripts", () => {
    const { violations } = check({ root: tree(files), config: { ...base, forbidden: [accountType] }, configName: "c" });
    expect(violations).toEqual([
      "features/a/bad.ts: no-account-type-branching — “if (user.accountTypeId === 3) go();” — use a permission, a scope or a qualifier.",
      "features/a/bad2.vue: no-account-type-branching — “if (access.webmaster()) go();” — use a permission, a scope or a qualifier.",
    ]);
  });

  it("keeps a // inside a string (a URL) so the match after it is found, and cuts a real comment", () => {
    const root = tree({ "features/a/index.ts": "", "features/a/routes.ts": "", "features/a/url.ts": 'export const u = "http://x.test"; const y = accountTypeId;\n', "features/a/c.ts": "const ok = 1; // accountTypeId\n" });
    const { violations } = check({ root, config: { ...base, forbidden: [accountType] }, configName: "c" });
    expect(violations.map((v) => v.split(":")[0])).toEqual(["features/a/url.ts"]);
  });

  it("takes an exclude that replaces the folder default, and an allowlist that is a ratchet", () => {
    const withExclude = check({ root: tree(files), config: { ...base, forbidden: [{ ...accountType, exclude: /^(features\/a\/bad2|e2e|docs|scripts)/ }] }, configName: "c" });
    expect(withExclude.violations.map((v) => v.split(":")[0])).toEqual(["features/a/bad.ts"]);
    const allowed = check({ root: tree(files), config: { ...base, forbidden: [accountType], allow: { "no-account-type-branching": ["features/a/bad.ts", "features/a/bad2.vue", "features/a/comment.ts"] } }, configName: "c.mjs" });
    expect(allowed.violations).toEqual(["features/a/comment.ts: stale no-account-type-branching allowlist entry in c.mjs — the file no longer trips the rule; remove it from the allowlist."]);
  });
});

describe("permission-texts", () => {
  const generated = "// This file is auto-generated.\n\nexport type Permission =\n  | 'crm.lead:view'\n  | 'crm.lead:manage'\n  | 'crm.lead.notes:view'\n  | 'customer:view';\n";
  const titles = { crm: { "lead:view": "a", "lead:manage": "b", lead: { "notes:view": "c" } }, "customer:view": "d" };
  const put = (locale, dir, value) => [`i18n/${dir}/${locale}.json`, JSON.stringify(value)];
  const complete = Object.fromEntries(["hr", "en"].flatMap((locale) => [put(locale, "policies", titles), put(locale, "policy_descriptions", titles)]));
  const permissions = { generated: "generated/permissions.ts", keys: ["policies.{id}", "policy_descriptions.{id}"], locales: ["hr", "en"] };
  const run = (files, config = permissions) => check({ root: tree({ "features/.keep.ts": "", "generated/permissions.ts": generated, ...files }), config: { ...base, permissions: config }, configName: "c" }).violations;

  it("reads the ids out of a generated union and ignores its comment", () => {
    expect(generatedIds(generated)).toEqual(["crm.lead:view", "crm.lead:manage", "crm.lead.notes:view", "customer:view"]);
  });

  it("is silent when every id has every key in every locale", () => {
    expect(run(complete)).toEqual([]);
  });

  it("names a missing text, in the file and the key", () => {
    const fewer = { ...titles };
    delete fewer["customer:view"];
    expect(run({ ...complete, ...Object.fromEntries([put("en", "policy_descriptions", fewer)]) })).toEqual([
      "i18n/policy_descriptions/en.json: permission-texts — customer:view has no text (policy_descriptions.customer:view).",
    ]);
  });

  it("names a text kept for an id that is gone, and a missing locale file", () => {
    const stale = { ...titles, crm: { ...titles.crm, "lead:archive": "x" } };
    const files = { ...complete, ...Object.fromEntries([put("hr", "policies", stale)]) };
    delete files["i18n/policies/en.json"];
    expect(run(files)).toEqual([
      "i18n/policies/hr.json: permission-texts — crm.lead:archive is not in generated/permissions.ts; remove its text.",
      "i18n/policies/en.json: permission-texts — the file does not exist.",
    ]);
  });
});
