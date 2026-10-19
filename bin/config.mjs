// Finds, loads and validates `vue-core.config.mjs` for the `vue-core` command. Plain Node, no dependency:
// the types of the file are src/config (`@wssto2/vue-core/config`).
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const CONFIG_FILE = "vue-core.config.mjs";

/** The top-level sections, one per command, with their defaults; a command that has defaults adds them here. */
export const DEFAULTS = {
  lint: {
    baselines: "scripts/lint-baselines.json",
    generated: ["generated"],
    patternCounters: [],
    // What the messages tell the developer to run; an application points them at its own npm scripts.
    commands: {
      update: "vue-core lint --update",
      typedUpdate: "LINT_TYPED=1 vue-core lint --update",
      typedReport: "LINT_TYPED=1 vue-core lint --report",
      typedReportAll: "LINT_TYPED=1 vue-core lint --report --all",
    },
    policy: "the project's lint policy",
  },
  architecture: {
    featuresDir: "features",
    alias: "@/",
    sharedLayers: ["components", "composables"],
    skip: ["dist", "generated", "node_modules"],
    allow: {},
    packs: [],
    rules: [],
    doc: {},
    copy: null,
    routeAccess: null,
  },
  generator: { template: join(dirname(fileURLToPath(import.meta.url)), "templates", "feature-crud"), out: "features" },
  e2eTimings: { report: "e2e-timings/results.json" },
};

export class ConfigError extends Error {}

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

/** The nearest `vue-core.config.mjs` from `from` upwards, or null. */
export function findConfig(from) {
  for (let dir = resolve(from); ; dir = dirname(dir)) {
    const candidate = join(dir, CONFIG_FILE);
    if (existsSync(candidate)) return candidate;
    if (dirname(dir) === dir) return null;
  }
}

/**
 * @param {{ cwd: string, path?: string }} options `path` is `--config`; without it the file is searched from `cwd`
 * @returns {Promise<{ path: string | null, root: string, config: typeof DEFAULTS }>} `root` is the config file's folder (`cwd` without a file);
 *   no file is valid and gives the defaults
 */
export async function loadConfig({ cwd, path }) {
  const file = path ? resolve(cwd, path) : findConfig(cwd);
  if (path && !existsSync(file)) throw new ConfigError(`--config ${path}: no such file`);
  let given = {};
  if (file) {
    const module = await import(pathToFileURL(file).href);
    given = module.default;
    if (!isObject(given)) throw new ConfigError(`${file}: the default export must be an object (export default defineConfig({ … }))`);
    const unknown = Object.keys(given).filter((key) => !(key in DEFAULTS));
    if (unknown.length > 0) throw new ConfigError(`${file}: unknown section ${unknown.join(", ")}; the sections are ${Object.keys(DEFAULTS).join(", ")}`);
    for (const [name, section] of Object.entries(given)) {
      if (!isObject(section)) throw new ConfigError(`${file}: "${name}" must be an object`);
    }
  }
  const config = Object.fromEntries(Object.entries(DEFAULTS).map(([name, defaults]) => [name, { ...defaults, ...given[name] }]));
  return { path: file, root: file ? dirname(file) : resolve(cwd), config };
}
