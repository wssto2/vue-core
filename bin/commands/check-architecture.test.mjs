import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "../cli.mjs";

const fixtures = join(process.cwd(), "test-data", "architecture");
// Vite (which runs the tests) cannot import a file outside the project, so the temporary trees live in node_modules.
const cache = join(process.cwd(), "node_modules", ".cache", "architecture");
mkdirSync(cache, { recursive: true });

async function check(dir, config) {
  const err = [];
  const out = [];
  const argv = config ? ["check-architecture", "--config", config] : ["check-architecture"];
  const code = await main(argv, { cwd: dir, out: (line) => out.push(line), err: (line) => err.push(line) });
  return { code, out, text: err.join("\n") };
}

/** A temporary application: `files` maps a path to its text; the config file is written for it. */
function app(files, config = "{}") {
  const dir = mkdtempSync(join(cache, "app-"));
  for (const [path, text] of Object.entries({ "vue-core.config.mjs": `export default { architecture: ${config} };`, ...files })) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

describe("vue-core check-architecture on the fixture trees", () => {
  it("reports one planted offender per rule, in the order the rules find them", async () => {
    const { code, out, text } = await check(join(fixtures, "app"));
    expect(code).toBe(1);
    expect(out).toEqual([]);
    expect(`${text}\n`).toBe(readFileSync(join(fixtures, "expected-app.txt"), "utf8"));
  });

  it("is silent and exits 0 on a clean tree", async () => {
    expect(await check(join(fixtures, "clean"))).toEqual({ code: 0, out: [], text: "" });
  });
});

describe("vue-core check-architecture rules", () => {
  const feature = { "features/orders/index.ts": "export const orders = 1;", "features/orders/routes.ts": "export const routes = [];" };

  it("follows the configured folders and alias, and names an unconfigured doc nowhere", async () => {
    const dir = app(
      {
        "modules/orders/index.ts": "",
        "modules/billing/index.ts": 'import { x } from "~/modules/orders/api";',
        "shared/Pick.ts": 'import "~/modules/orders";',
        "main.ts": 'import "~/modules/orders/deep";',
      },
      '{ featuresDir: "modules", alias: "~/", sharedLayers: ["shared"] }',
    );
    const { code, text } = await check(dir);
    expect(code).toBe(1);
    expect(text).toContain('- main.ts: import feature code through "~/modules/orders" (or "~/modules/orders/routes"), not the internal path "~/modules/orders/deep".');
    expect(text).toContain('- modules/billing/index.ts: feature "modules/billing" cannot import "~/modules/orders/api".');
    expect(text).toContain('- shared/Pick.ts: the shared layer (shared/) cannot import "~/modules/orders" — take what the feature provides as a prop or callback, or move this code into the feature.');
  });

  it("allows entities, schemas and routes of the generated folder by default, and nothing else", async () => {
    const dir = app({ ...feature, "main.ts": 'import "@/generated/entities/a";\nimport "@/generated/schemas/b";\nimport "@/generated/routes/c";\nimport "@/generated/permissions";' });
    const { text } = await check(dir);
    expect(text).toBe('Frontend architecture violations:\n\n- main.ts: import generated code only through "@/generated/entities/*", "@/generated/schemas/*" or "@/generated/routes/*".');
  });

  it("an exact generated entry is one module, not a prefix", async () => {
    const dir = app({ ...feature, "main.ts": 'import "@/generated/permissions";\nimport "@/generated/permissionsX";' }, '{ generated: { allowed: ["permissions"] } }');
    expect((await check(dir)).text).toContain('only through "@/generated/permissions".');
  });

  it("runs no pack rule unless the pack is named", async () => {
    const files = { ...feature, "features/orders/Box.vue": '<template><table class="bg-zinc-100"></table></template>' };
    expect((await check(app(files))).code).toBe(0);
    const { text } = await check(app(files, '{ packs: ["presentation"] }'));
    expect(text).toContain("features/orders/Box.vue: no-raw-table");
    expect(text).not.toContain("no-stray-neutral");
  });

  it("a stale pack allowlist entry is a violation, a used one is silent", async () => {
    const files = { ...feature, "features/orders/Box.vue": "<template><table></table></template>", "features/orders/Fine.vue": "<template><p>x</p></template>" };
    const config = '{ packs: ["presentation"], allow: { "no-raw-table": ["features/orders/Box.vue", "features/orders/Fine.vue"] } }';
    expect((await check(app(files, config))).text).toBe(
      "Frontend architecture violations:\n\n- features/orders/Fine.vue: stale no-raw-table allowlist entry in vue-core.config.mjs — the file no longer trips the rule; remove it from the allowlist.",
    );
  });

  it("calls the application's rules per file with the template and imports, and prefixes their messages", async () => {
    const dir = app(
      { ...feature, "features/orders/Row.vue": '<script setup lang="ts">import "./x";</script><template><b>hi</b></template>', "features/orders/x.test.ts": "" },
      `{ rules: [({ file, template, imports, isVue, isTest }) => (file.endsWith(".vue") && isVue && !isTest ? [template + ":" + imports.join()] : [])] }`,
    );
    expect((await check(dir)).text).toBe("Frontend architecture violations:\n\n- features/orders/Row.vue: <b>hi</b>:./x");
  });

  it("fails with exit 2 on a config it cannot use", async () => {
    const bad = async (config, files = feature) => await check(app(files, config));
    expect((await bad('{ packs: ["nope"] }')).text).toContain('packs: unknown pack "nope"');
    expect((await bad('{ allow: { "no-raw-table": ["a.vue"] } }')).text).toContain("allow.no-raw-table: no such rule");
    expect((await bad('{ doc: { oops: "x" } }')).text).toContain("doc.oops: no such rule");
    expect((await bad("{ rules: [1] }")).text).toContain("every entry must be a function");
    const missing = await bad("{}", { "main.ts": "" });
    expect(missing.code).toBe(2);
    expect(missing.text).toContain("featuresDir:");
  });
});

describe("vue-core check-architecture: no-hardcoded-copy", () => {
  const feature = { "features/orders/index.ts": "export const orders = 1;", "features/orders/routes.ts": "export const routes = [];" };
  const copy = '{ copy: { pattern: /[čćžšđ]|\\b(Spremi|Odustani)\\b/, properNames: /Škoda/g } }';

  it("is off unless the architecture config has a `copy` section", async () => {
    const files = { ...feature, "features/orders/Box.vue": "<template><p>Spremi</p></template>" };
    expect((await check(app(files))).code).toBe(0);
  });

  it("finds copy in a template's text nodes, in the copy attributes and, in scope, in every string literal", async () => {
    const dir = app(
      {
        ...feature,
        "features/orders/Text.vue": "<template><p>Spremi</p></template>",
        "features/orders/Attr.vue": '<template><input placeholder="Unesi šifru" :title="t(\'ok\')" /></template>',
        "features/orders/Script.vue": '<script setup lang="ts">const label = "Odustani";</script><template><p>{{ label }}</p></template>',
        "features/orders/labels.ts": 'export const label = "Odustani";',
        "lib/labels.ts": 'export const label = "Odustani";',
        "lib/OutOfScope.vue": '<script setup lang="ts">const label = "Odustani";</script><template><p>{{ t(label) }}</p></template>',
        "features/orders/Clean.vue": "<template><p>{{ $t('orders.save') }} Škoda</p></template>",
      },
      copy,
    );
    const { code, text } = await check(dir);
    expect(code).toBe(1);
    expect(text).toContain("- features/orders/Attr.vue: no-hardcoded-copy — hardcoded copy in a user-facing string (“Unesi šifru”)");
    expect(text).toContain("- features/orders/Script.vue: no-hardcoded-copy — hardcoded copy in a user-facing string (“\"Odustani\"”)");
    expect(text).toContain("- features/orders/Text.vue: no-hardcoded-copy — hardcoded copy in a user-facing string (“Spremi”)");
    expect(text).toContain("- features/orders/labels.ts: no-hardcoded-copy");
    expect(text).not.toContain("lib/");
    expect(text).not.toContain("Clean.vue");
  });

  it("takes the scope and the proper names it is given, and never scans a test", async () => {
    const files = { ...feature, "lib/labels.ts": 'export const label = "Odustani";', "features/orders/Brand.vue": "<script setup lang=\"ts\">const brand = \"Škoda\";</script><template><p>{{ brand }}</p></template>", "features/orders/Brand.test.ts": 'const x = "Spremi";' };
    const config = '{ copy: { pattern: /[čćžšđ]|\\b(Spremi|Odustani)\\b/, properNames: /Škoda/g, scope: /^(features|lib)\\// } }';
    expect((await check(app(files, config))).text).toBe('Frontend architecture violations:\n\n- lib/labels.ts: no-hardcoded-copy — hardcoded copy in a user-facing string (“"Odustani"”) — move it to an i18n key.');
  });

  it("keeps its allowlist a ratchet, and refuses a config without a pattern", async () => {
    const files = { ...feature, "features/orders/Box.vue": "<template><p>Spremi</p></template>", "features/orders/Fine.vue": "<template><p>ok</p></template>" };
    const allowed = '{ copy: { pattern: /Spremi/ }, allow: { "no-hardcoded-copy": ["features/orders/Box.vue", "features/orders/Fine.vue"] } }';
    expect((await check(app(files, allowed))).text).toBe(
      "Frontend architecture violations:\n\n- features/orders/Fine.vue: stale no-hardcoded-copy allowlist entry in vue-core.config.mjs — the file no longer trips the rule; remove it from the allowlist.",
    );
    expect((await check(app(files, "{ copy: {} }"))).text).toContain("copy.pattern: a regular expression");
    expect((await check(app(files, '{ allow: { "no-hardcoded-copy": ["x"] } }'))).text).toContain("allow.no-hardcoded-copy: no such rule");
  });
});

describe("vue-core check-architecture: no-route-policy", () => {
  const files = {
    "features/orders/index.ts": "export const orders = 1;",
    "features/orders/routes.ts": "export const routes = [{ path: '/', meta: {\n  policy: 'orders:view',\n  requires: ['x'] } }];",
    "features/orders/Other.ts": "const meta = { policy: 'fine here' };",
    "app/guard.ts": "const held = authStore.policies; // not state.policies\nconst ok = session.access;",
    "app/comment.ts": "// authStore.policies is gone\n/* state.policies */",
    "docs/routes.ts": "const meta = {\n policy: 'x' };",
    "features/orders/routes.test.ts": "const meta = {\n policy: 'x' };",
  };

  it("is off unless the architecture config has a `routeAccess` section", async () => {
    expect((await check(app(files))).code).toBe(0);
  });

  it("flags policy: / requires: in a routes.ts and the old session field, by the field's name, outside the excluded folders and comments", async () => {
    const { code, text } = await check(app(files, "{ routeAccess: { sessionField: 'policies', exclude: /^docs\\// } }"));
    expect(code).toBe(1);
    expect(text).toContain("- features/orders/routes.ts: no-route-policy — “policy: 'orders:view',”");
    expect(text).toContain("- app/guard.ts: no-route-policy — “const held = authStore.policies;");
    expect(text).not.toContain("Other.ts");
    expect(text).not.toContain("comment.ts");
    expect(text).not.toContain("docs/");
    expect(text).not.toContain("routes.test.ts");
    expect((await check(app(files, "{ routeAccess: { sessionField: 'grants', exclude: /^docs\\// } }"))).text).not.toContain("app/guard.ts");
  });
});
