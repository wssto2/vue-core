import { defineConfig } from "@wssto2/vue-core/config";

export default defineConfig({
  architecture: {
    // The defaults: features/, the "@/" alias, components/ and composables/ as the shared layer.
    generated: { allowed: ["entities/*", "schemas/*", "routes/*", "permissions"] },
    packs: ["design-values", "presentation"],
    // No text of the authors' language in a template or a string a person reads (here Croatian), and no `policy:` in a routes.ts.
    copy: { pattern: /[čćžšđ]|\b(Spremi|Odustani)\b/, properNames: /Njuškalo|Škoda/g },
    routeAccess: { sessionField: "policies", exclude: /^(e2e|scripts|docs)\// },
    // The generated permissions have a title and a description in every locale file (i18n/policies/hr.json, ...).
    permissions: { generated: "generated/permissions.ts", keys: ["policies.{id}", "policy_descriptions.{id}"], locales: ["hr", "en"] },
    // A line of the application's own to forbid, as data (comments, tests, e2e, docs and scripts are not scanned).
    forbidden: [{ id: "no-account-type-branching", pattern: /\baccountTypeId\b|\bisStaffAccount\s*\(/, message: "use a permission, a scope or a qualifier" }],
    // Known offenders that predate a rule; the lists only shrink.
    allow: { "feature-name": ["features/old_stuff"], "no-hardcoded-copy": ["features/vehicles/form.ts"] },
    doc: { "shared-layer": "docs/architecture.md, Shared layer" },
    // The application's own rules: the messages for one file, each prefixed with its path.
    rules: [({ content, isTest }) => (!isTest && content.includes("debugger") ? ["no-debugger — remove it"] : [])],
  },
});
