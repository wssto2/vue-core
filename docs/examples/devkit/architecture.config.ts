import { defineConfig } from "@wssto2/vue-core/config";

export default defineConfig({
  architecture: {
    // The defaults: features/, the "@/" alias, components/ and composables/ as the shared layer.
    generated: { allowed: ["entities/*", "schemas/*", "routes/*", "permissions"] },
    packs: ["design-values", "presentation"],
    // Known offenders that predate a rule; the lists only shrink.
    allow: { "feature-name": ["features/old_stuff"] },
    doc: { "shared-layer": "docs/architecture.md, Shared layer" },
    // The application's own rules: the messages for one file, each prefixed with its path.
    rules: [({ content, isTest }) => (!isTest && content.includes("debugger") ? ["no-debugger — remove it"] : [])],
  },
});
