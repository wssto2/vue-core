// `vue-core check-architecture`: the feature-folder rules (features import no other feature, outside code reaches a feature
// only through index.ts / routes.ts, the shared layer imports no feature, generated code only through its subpaths, HTTP only in
// api.ts, one ApiError, single-word folder names, views/ needs index.ts + routes.ts) plus the opt-in packs. Exit 1 on a violation.
import { existsSync } from "node:fs";
import path from "node:path";

import { check } from "../architecture/engine.mjs";
import { PACKS } from "../architecture/packs.mjs";

const ALLOW_RULES = ["deep-import", "raw-http", "feature-name", "feature-shape"];
const DOC_KEYS = ["shared-layer", "api-error"];

export default function run({ config, root, configPath, err }) {
  const generated = { dir: "generated", allowed: ["entities/*", "schemas/*", "routes/*"], moved: {}, ...config.generated };
  const settings = { ...config, generated, uiDirs: config.uiDirs ?? [config.featuresDir, "components"] };

  const problems = [];
  for (const name of settings.packs) if (!Object.hasOwn(PACKS, name)) problems.push(`packs: unknown pack "${name}"; the packs are ${Object.keys(PACKS).join(", ")}`);
  const packRules = settings.packs.filter((name) => Object.hasOwn(PACKS, name)).flatMap((name) => PACKS[name].rules.map((rule) => rule.id));
  for (const rule of Object.keys(settings.allow)) {
    if (!ALLOW_RULES.includes(rule) && !packRules.includes(rule)) problems.push(`allow.${rule}: no such rule; the allowlists are ${[...ALLOW_RULES, ...packRules].join(", ")}`);
  }
  for (const key of Object.keys(settings.doc)) if (!DOC_KEYS.includes(key) && !packRules.includes(key)) problems.push(`doc.${key}: no such rule; the doc references are ${[...DOC_KEYS, ...packRules].join(", ")}`);
  for (const rule of settings.rules) if (typeof rule !== "function") problems.push("rules: every entry must be a function ({ file, content, template, imports, isVue, isTest }) => string[]");
  if (!existsSync(path.join(root, settings.featuresDir))) problems.push(`featuresDir: ${path.join(root, settings.featuresDir)} does not exist`);
  if (problems.length > 0) {
    err(`vue-core check-architecture: ${configPath ?? "no config file"}\n${problems.map((problem) => `  ${problem}`).join("\n")}`);
    return 2;
  }

  const { violations, warnings } = check({ root, config: settings, configName: configPath ? path.basename(configPath) : "the architecture config" });
  if (warnings.length > 0) err(`Frontend architecture warnings:\n\n${warnings.map((warning) => `- ${warning}`).join("\n")}\n`);
  if (violations.length > 0) {
    err(`Frontend architecture violations:\n\n${violations.map((violation) => `- ${violation}`).join("\n")}`);
    return 1;
  }
  return 0;
}
