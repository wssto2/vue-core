import { defineConfig } from "@wssto2/vue-core/config";

export default defineConfig({
  architecture: {
    // The defaults: features/, the "@/" alias, components/ and composables/ as the shared layer.
    generated: { allowed: ["entities/*", "schemas/*", "routes/*", "permissions"] },
    packs: ["design-values", "presentation"],
    // No text of the authors' language in a template or a string a person reads (here Croatian), and no `policy:` in a routes.ts.
    copy: { pattern: /[čćžšđ]|\b(Spremi|Odustani)\b/, properNames: /Njuškalo|Škoda/g },
    routeAccess: { sessionField: "policies", exclude: /^(e2e|scripts|docs)\// },
    // Known offenders that predate a rule; the lists only shrink.
    allow: { "feature-name": ["features/old_stuff"], "no-hardcoded-copy": ["features/vehicles/form.ts"] },
    doc: { "shared-layer": "docs/architecture.md, Shared layer" },
    // The application's own rules: the messages for one file, each prefixed with its path.
    rules: [({ content, isTest }) => (!isTest && content.includes("debugger") ? ["no-debugger — remove it"] : [])],
  },
});
