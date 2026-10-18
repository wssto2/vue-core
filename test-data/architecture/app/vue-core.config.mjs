// The fixture's config: ARV's folders, both packs, one custom rule and the allowlists.
export default {
  architecture: {
    generated: { allowed: ["entities/*", "schemas/*", "routes/*", "permissions"], moved: { "@/entities/": "@/generated/entities" } },
    packs: ["design-values", "presentation"],
    allow: {
      "deep-import": ["main.ts -> @/features/orders/helpers"],
      "raw-http": ["features/orders/legacy.ts"],
      "feature-name": ["features/Old_Stuff"],
      "feature-shape": ["features/archive"],
      "no-raw-form-control": ["features/orders/components/LegacyForm.vue"],
      // Offender (stale): this file no longer trips the rule.
      "no-raw-table": ["features/orders/components/CleanTable.vue"],
    },
    doc: { "shared-layer": "docs: shared layer", "collection-table-roles": "docs: collections" },
    rules: [({ content, isTest }) => (!isTest && /TODO/.test(content) ? ["no-todo — finish it or file an issue"] : [])],
  },
};
