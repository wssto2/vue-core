// The two rules arv-next wrote itself (frontend/vue-core.config.mjs at origin/dev e2197641c, rules 6/6b and 9) are `no-hardcoded-copy` and
// `no-route-policy` here. This feeds arv-next's own functions, copied below unchanged, and the new rules with arv-next's configuration the same
// files, and requires the same files and the same offending line from both.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULTS } from "../config.mjs";
import { check } from "./engine.mjs";

// ---- arv-next's functions, verbatim -------------------------------------------------------------------------------------------------
const plainSource = ({ file, isTest }) => isTest || /^(e2e|review|scripts|tests|docs|templates|static)\//.test(file);
const withoutComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const ROUTE_META_POLICY = /^\s*(policy|requires)\s*:/;
const AUTH_STORE_POLICIES = /\bauthStore\.policies\b|\bstate\.policies\b/;
const routeMetaNamesAccess = (source) => {
  if (plainSource(source)) return [];
  const isRouteFile = /(^|\/)routes\.ts$/.test(source.file);
  const hit = withoutComments(source.content)
    .split("\n")
    .find((line) => (isRouteFile && ROUTE_META_POLICY.test(line)) || AUTH_STORE_POLICIES.test(line));
  return hit ? [`“${hit.trim().slice(0, 80)}” — a route needs \`meta.permission\``] : [];
};
const CROATIAN_TEXT =
  /[čćžšđČĆŽŠĐ]|\b(Nema|Odaberite?|Odaberi|Unesite|Molimo|Obavezno|Spremi|Odustani|Uredi|Dodaj|Zatvori|Potvrdi|Naziv|Datum|Odjava|Prijava|zapisa|ukupno|Prikaz|Odabir|Kreiraj)\b/;
const i18nDriftAllowlist = new Set(["features/vehicles/form.ts"]);
const COPY_SCOPE = /^(features|components)\//;
const PROPER_NAMES = /Njuškalo|Škoda/g;
const COPY_ATTRIBUTE = /(?<![\w-])(:|v-bind:)?(placeholder|title|aria-label|label)="([^"]*)"/g;
const literals = (code) => code.match(/(["'`])(?:\\.|(?!\1).)*\1/g) ?? [];
const codeWithoutComments = (code) =>
  code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/(^|[^:"'`\\])\/\/.*$/, "$1"))
    .join("\n");
function copyLiterals(content, isVue) {
  const scripts = isVue ? [...content.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]) : [content];
  const found = scripts.flatMap((script) => literals(codeWithoutComments(script)));
  if (isVue) {
    const template = (content.match(/<template>([\s\S]*)<\/template>/)?.[1] ?? "").replace(/<!--[\s\S]*?-->/g, "");
    for (const [, bound, , value] of template.matchAll(COPY_ATTRIBUTE)) found.push(...(bound ? literals(value) : [value]));
  }
  return found;
}
const noHardcodedCroatian = ({ file, content, isVue, isTest }) => {
  if (isTest || i18nDriftAllowlist.has(file)) return [];
  let scanText = null;
  if (isVue) {
    const tpl = content.match(/<template>([\s\S]*)<\/template>/);
    if (tpl) scanText = tpl[1].replace(/<!--[\s\S]*?-->/g, "").replace(/\{\{[\s\S]*?\}\}/g, "").replace(/<[^>]+>/g, "\n");
  } else if (file.endsWith(".ts")) {
    const segments = file.split("/");
    const base = segments[segments.length - 1];
    if (base === "form.ts" || /Form\.ts$/.test(base) || segments.includes("forms")) {
      const noComments = content
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .filter((line) => !/^\s*\/\//.test(line))
        .join("\n");
      scanText = literals(noComments).join("\n");
    }
  }
  if (COPY_SCOPE.test(file)) scanText = [scanText ?? "", ...copyLiterals(content, isVue)].join("\n").replace(PROPER_NAMES, "");
  const hit = scanText
    ?.split("\n")
    .map((line) => line.trim())
    .find((line) => line.length >= 3 && CROATIAN_TEXT.test(line));
  return hit ? [`hardcoded Croatian in a user-facing string (“${hit.slice(0, 60)}”)`] : [];
};
// ---- arv-next's configuration, as it now becomes data --------------------------------------------------------------------------------
const arvConfig = {
  copy: { pattern: CROATIAN_TEXT, scope: COPY_SCOPE, properNames: PROPER_NAMES },
  routeAccess: { sessionField: "policies", exclude: /^(e2e|review|scripts|tests|docs|templates|static)\// },
  allow: { "no-hardcoded-copy": ["features/vehicles/form.ts"] },
};

const vue = (extra) => `<script setup lang="ts">\nconst a = 1;\n</script>\n<template>\n<div>${extra ?? ""}</div>\n</template>\n`;
const files = {
  "features/orders/index.ts": "export const orders = 1;",
  "features/orders/routes.ts": "export const routes = [];",
  // templates: text nodes, attributes, bound attributes, comments, interpolations, proper names
  "features/orders/A.vue": vue("Spremi spremljeno"),
  "features/orders/B.vue": vue('<input placeholder="Unesite šifru" />'),
  "features/orders/C.vue": vue("<x :label=\"on ? 'Odustani' : t('k')\" />"),
  "features/orders/D.vue": vue("<!-- Spremi --><b>Škoda</b> {{ 'Spremi' }}"),
  "features/orders/E.vue": vue('<x title="Škoda" aria-label="ok" />'),
  "features/orders/F.vue": '<script setup lang="ts">\nconst z = "Datum rođenja"; // Odustani\n</script>\n<template><p>{{ z }}</p></template>',
  "features/orders/G.vue": '<script setup lang="ts">\n/* Zatvori */ const z = `ok`;\n</script>\n<template><p>{{ z }}</p></template>',
  "features/orders/H.vue": vue("fine") + "<script>const q = 'Njuškalo';</script>",
  "features/orders/I.vue": vue('<x :title="`Nema ${n} zapisa`" />'),
  "features/orders/J.vue": vue("ab"),
  // scripts: in scope every literal, outside only the form files
  "features/orders/labels.ts": 'export const l = "Odustani";\n',
  "features/orders/form.ts": 'import { z } from "zod";\nexport const f = z.string().min(1, "Obavezno polje");\n// Spremi\n',
  "features/orders/OrderForm.ts": 'export const f = { a: "Unesite broj" };\n',
  "features/orders/forms/q.ts": 'const x = "Kreiraj";\n',
  "features/orders/comments.ts": "// Spremi\n/* Datum */\nexport const ok = `${a}`;\n",
  "features/orders/brand.ts": "export const n = 'Njuškalo Škoda';\n",
  "features/orders/short.ts": "export const n = 'č';\n",
  "components/Box.vue": vue("Prikaz"),
  "lib/labels.ts": 'export const l = "Odustani";\n',
  "lib/forms/f.ts": 'export const l = "Odustani";\n',
  "lib/Page.vue": vue("Uredi"),
  "features/vehicles/index.ts": "export const v = 1;",
  "features/vehicles/routes.ts": "export const routes = [];",
  "features/vehicles/form.ts": 'export const f = "Obavezno polje";\n',
  "features/orders/Box.test.ts": 'const x = "Spremi";\n',
  "tests/labels.ts": 'const x = "Spremi";\n',
  // routes: policy / requires / the session's old list, comments, excluded folders
  "features/orders/R1/routes.ts": "export const r = [{\n  meta: {\n    policy: 'a:view',\n  },\n}];\n",
  "features/orders/R2/routes.ts": "export const r = [{ meta: { requires: ['x'] } }];\nconst s = {\n  requires: 1 };\n",
  "features/orders/R3/routes.ts": "// policy: a\n/*\n  requires: b\n*/\nexport const r = [];\n",
  "features/orders/R4.ts": "const meta = {\n  policy: 'fine outside routes.ts' };\n",
  "app/guard.ts": "const held = authStore.policies; // x\n",
  "app/guard2.ts": "const held = state.policies;\nconst ok = state.policiesX;\n",
  "app/guard3.ts": "// authStore.policies\nconst ok = other.policies;\n",
  "docs/routes.ts": "const m = {\n  policy: 'x' };\nconst h = authStore.policies;\n",
  "static/routes.ts": "const m = {\n  requires: 'x' };\n",
  "features/orders/R5/routes.test.ts": "const m = {\n  policy: 'x' };\n",
};

const cache = join(process.cwd(), "node_modules", ".cache", "architecture");
mkdirSync(cache, { recursive: true });
function tree() {
  const dir = mkdtempSync(join(cache, "parity-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}
const base = { ...DEFAULTS.architecture, generated: { dir: "generated", allowed: [], moved: {} }, uiDirs: ["features", "components"], allow: {} };
// the offending line of each file: the text between the curly quotes
const found = (violations) => Object.fromEntries(violations.filter((v) => v.includes("“")).map((v) => [v.slice(0, v.indexOf(":")), v.match(/“(.*?)”/)?.[1]]));

describe("arv-next's own architecture rules, as vue-core's no-hardcoded-copy and no-route-policy", () => {
  const root = tree();
  const oracle = check({ root, config: { ...base, rules: [noHardcodedCroatian, routeMetaNamesAccess] }, configName: "oracle" }).violations;
  const fresh = check({ root, config: { ...base, ...arvConfig }, configName: "new" }).violations;

  it("finds the same files and the same offending lines for copy", () => {
    const expected = found(oracle.filter((v) => v.includes("hardcoded Croatian")));
    expect(Object.keys(expected).length).toBeGreaterThan(10);
    // the oracle skips the allowlisted file silently; the rule sees it trip and keeps the entry
    expect(found(fresh.filter((v) => v.includes("no-hardcoded-copy")))).toEqual(expected);
    expect(fresh.some((v) => v.includes("stale"))).toBe(false);
  });

  it("finds the same files and the same offending lines for route policies", () => {
    const expected = found(oracle.filter((v) => v.includes("meta.permission")));
    expect(Object.keys(expected).length).toBeGreaterThan(3);
    expect(found(fresh.filter((v) => v.includes("no-route-policy")))).toEqual(expected);
  });

  it("is not a vacuous comparison: both sides leave the clean files alone", () => {
    const names = Object.keys(found(fresh));
    for (const clean of ["features/orders/J.vue", "features/orders/E.vue", "features/orders/comments.ts", "features/orders/Box.test.ts", "lib/labels.ts", "docs/routes.ts", "features/orders/R4.ts"]) expect(names).not.toContain(clean);
  });
});
