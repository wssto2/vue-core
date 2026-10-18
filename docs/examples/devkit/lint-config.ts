import { defineConfig } from "@wssto2/vue-core/config";

// The `lint` section of vue-core.config.mjs. Every key is optional.
export default defineConfig({
  lint: {
    baselines: "scripts/lint-baselines.json",
    generated: ["generated"],
    // Debt ESLint cannot count itself: an inline disable is invisible to the rule it silences.
    patternCounters: [
      {
        name: "vue/no-v-html disable directives",
        extensions: [".vue", ".ts"],
        pattern: /eslint-disable(?:-next-line)?[^\n]*vue\/no-v-html/g,
        hint: "each disable needs an audited justification",
      },
    ],
    // What the messages tell the developer to run, when the application wraps the command in npm scripts.
    commands: { update: "npm run lint:update-baselines", typedUpdate: "npm run lint:typed:update" },
    policy: "documentation/rules.md",
  },
});
