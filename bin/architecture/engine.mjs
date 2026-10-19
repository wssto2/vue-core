// The checks behind `vue-core check-architecture`: walks the source tree under `root` and returns the violations and warnings
// in the order they are found (per file in path order, then the stale allowlist entries, then the feature-folder rules).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { PACKS } from "./packs.mjs";
import { builtInRules } from "./rules.mjs";

const SOURCE_EXTENSIONS = new Set([".ts", ".vue"]);
const toPosix = (value) => value.split(path.sep).join("/");
const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
const entries = (dir) => readdirSync(dir, { withFileTypes: true }).sort(byName);
const sentence = (items) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} or ${items.at(-1)}` : items[0]);

/**
 * @param {object} options
 * @param {string} options.root the folder the config file lives in; `alias` points at it
 * @param {object} options.config the `architecture` section, defaults applied
 * @param {string} options.configName how a stale allowlist message names the config file
 */
export function check({ root, config, configName }) {
  const { featuresDir, alias, sharedLayers, generated, skip, uiDirs, doc } = config;
  const allow = Object.fromEntries(Object.entries(config.allow).map(([rule, files]) => [rule, new Set(files)]));
  const allowed = (rule) => allow[rule] ?? new Set();
  const docRef = (key, join = " (") => (doc[key] ? `${join}${doc[key]}${join === " (" ? ")" : ""}` : "");
  const packs = config.packs.map((name) => PACKS[name]);
  const packRules = packs.flatMap((pack, index) => pack.rules.map((rule) => ({ ...rule, pack: packs[index], seen: new Set() })));
  const builtIns = builtInRules(config);
  const featuresRoot = path.join(root, featuresDir);
  const violations = [];
  const warnings = [];

  const featureRoots = getFeatureRoots();
  const owningFeature = (relativePath) => featureRoots.find((feature) => relativePath === feature || relativePath.startsWith(`${feature}/`)) ?? null;
  const featuresPrefix = `${alias}${featuresDir}/`;
  const generatedPrefix = `${alias}${generated.dir}/`;
  const generatedAllowed = generated.allowed.map((entry) => `${alias}${generated.dir}/${entry}`);
  const isGeneratedAllowed = (specifier) =>
    generatedAllowed.some((entry) => (entry.endsWith("/*") ? specifier.startsWith(entry.slice(0, -1)) : specifier === entry));

  for (const filePath of collectSourceFiles(root)) {
    const file = toPosix(path.relative(root, filePath));
    const importerFeature = owningFeature(file);
    const content = readFileSync(filePath, "utf8");
    const isVue = file.endsWith(".vue");
    const isApiFile = /(^|\/)api\.ts$/.test(file);
    const isTest = /(^|\/)tests?\//.test(file) || /\.(test|spec)\.[jt]sx?$/.test(file);
    const imports = extractImportSpecifiers(content);

    for (const specifier of imports) {
      // the shared layer imports no feature (aliased or relative)
      if (sharedLayers.some((layer) => file.startsWith(`${layer}/`))) {
        const target = specifier.startsWith(alias) ? specifier.slice(alias.length) : specifier.startsWith(".") ? toPosix(path.join(path.dirname(file), specifier)) : null;
        if (target === featuresDir || target?.startsWith(`${featuresDir}/`)) {
          violations.push(
            `${file}: the shared layer (${sharedLayers.map((layer) => `${layer}/`).join(", ")}) cannot import "${specifier}" — take what the feature provides as a prop or callback, or move this code into the feature${docRef("shared-layer")}.`,
          );
        }
      }

      for (const [from, to] of Object.entries(generated.moved)) {
        if (specifier.startsWith(from)) violations.push(`${file}: replace legacy "${from.replace(/\/$/, "")}" imports with "${to}".`);
      }

      if (specifier.startsWith(generatedPrefix) && !isGeneratedAllowed(specifier)) {
        violations.push(`${file}: import generated code only through ${sentence(generatedAllowed.map((entry) => `"${entry}"`))}.`);
      }

      // deep import into a feature from outside every feature: `index.ts` is the public surface, `routes.ts` the one extra entry point
      if (!importerFeature && specifier.startsWith(featuresPrefix)) {
        const bare = specifier.slice(alias.length);
        const importedFeature = owningFeature(bare);
        if (importedFeature && bare !== importedFeature && bare !== `${importedFeature}/routes` && !allowed("deep-import").has(`${file} -> ${specifier}`)) {
          violations.push(`${file}: import feature code through "${alias}${importedFeature}" (or "${alias}${importedFeature}/routes"), not the internal path "${specifier}".`);
        }
      }

      if (!importerFeature || !specifier.startsWith(featuresPrefix)) continue;
      const importedFeature = owningFeature(specifier.slice(alias.length));
      if (!importedFeature || importedFeature === importerFeature) continue;
      violations.push(`${file}: feature "${importerFeature}" cannot import "${specifier}". Import shared code or the owning app-shell route instead.`);
    }

    // raw fetch()/axios outside an api.ts (tests exempt). A URL/string first argument tells a real global-fetch call from a
    // bare `fetch()` invocation of a local refresh function.
    if (!isApiFile && !isTest) {
      const rawFetch = /(?<![.\w])fetch\s*\(\s*[`'"]/.test(content);
      const usesAxios = /(?<![.\w])axios\s*[.(]/.test(content) || /["'`]axios["'`]/.test(content);
      if ((rawFetch || usesAxios) && !allowed("raw-http").has(file)) {
        violations.push(
          `${file}: no raw fetch()/axios outside an api.ts — route the call through the platform client (currentRuntime().platform.http) so it shares error handling and ApiError.`,
        );
      }
    }

    // the application's own rules
    if (config.rules.length > 0) {
      const template = content.match(/<template>([\s\S]*)<\/template>/)?.[1] ?? "";
      for (const rule of config.rules) {
        for (const message of rule({ file, content, template, imports, isVue, isTest }) ?? []) violations.push(`${file}: ${message}`);
      }
    }

    // the built-in rules with options (`copy`, `routeAccess`)
    for (const rule of builtIns) {
      const message = rule.check({ file, content, isVue, isTest });
      if (!message) continue;
      if (allowed(rule.id).has(file)) rule.seen.add(file);
      else violations.push(`${file}: ${rule.id} — ${message}${docRef(rule.id)}.`);
    }

    // a failed request is vue-core's `ApiError`; a second class makes `isApiError` miss the errors of the other client
    if (/\bclass\s+\w*ApiError\b/.test(content)) {
      violations.push(
        `${file}: declares a second ApiError class — a failed request is vue-core's ApiError (import { ApiError, isApiError } from "@wssto2/vue-core/client"${docRef("api-error", "; ")}).`,
      );
    }
    for (const m of content.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
      if (m[2] !== "@wssto2/vue-core/client" && /(^|[\s,])(ApiError|isApiError)\b/.test(m[1].replace(/\bas\s+\w+/g, ""))) {
        violations.push(`${file}: imports ApiError from "${m[2]}" — the one error class comes from "@wssto2/vue-core/client"${docRef("api-error")}.`);
      }
    }

    // the packs
    if (packs.length > 0) {
      const template = content.match(/<template>([\s\S]*)<\/template>/)?.[1] ?? "";
      const classLists = [...content.matchAll(/(?:\bclass|:class)="([^"]*)"/g)].map((m) => m[1].split(/\s+/).filter(Boolean));
      for (const rule of packRules) {
        if (!rule.pack.applies({ file, isVue, featuresDir, uiDirs }) || !rule.test(content, template, classLists)) continue;
        if (allowed(rule.id).has(file)) rule.seen.add(file);
        else violations.push(`${file}: ${rule.id} — ${rule.hint}${docRef(rule.id)}.`);
      }
    }
  }

  // a stale allowlist entry (the file no longer trips the rule) is a violation: the lists only shrink
  for (const rule of [...packRules, ...builtIns]) {
    for (const entry of allowed(rule.id)) {
      if (!rule.seen.has(entry)) {
        violations.push(`${entry}: stale ${rule.id} allowlist entry in ${configName} — the file no longer trips the rule; remove it from the allowlist.`);
      }
    }
  }

  // every directory name under the features folder is a single lowercase word
  for (const dirPath of collectFeatureDirs(featuresRoot)) {
    const rel = toPosix(path.relative(root, dirPath));
    const name = rel.split("/").pop();
    if (!/^[a-z][a-z0-9]*$/.test(name) && !allowed("feature-name").has(rel)) {
      violations.push(`${rel}: feature directory name "${name}" must be a single lowercase word (^[a-z][a-z0-9]*$), matching the backend route/policy convention.`);
    }
  }

  // a feature leaf (a directory at depth 1 or 2 that directly holds views/) ships index.ts and routes.ts; api.ts is a warning
  for (const leaf of collectFeatureLeaves(featuresRoot)) {
    const rel = toPosix(path.relative(root, leaf));
    if (allowed("feature-shape").has(rel)) continue;
    for (const required of ["index.ts", "routes.ts"]) {
      if (!existsSync(path.join(leaf, required))) violations.push(`${rel}: a feature with views/ must ship ${required} (its public surface / route table).`);
    }
    if (!existsSync(path.join(leaf, "api.ts"))) warnings.push(`${rel}: no api.ts — expected for any feature that talks to the backend.`);
  }

  return { violations, warnings };

  // the directories with an index.ts at depth 1 or 2 under the features folder, the longest path first
  function getFeatureRoots() {
    const roots = [];
    for (const entry of entries(featuresRoot)) {
      if (!entry.isDirectory()) continue;
      const top = path.join(featuresRoot, entry.name);
      if (existsSync(path.join(top, "index.ts"))) roots.push(toPosix(path.relative(root, top)));
      for (const nested of entries(top)) {
        if (!nested.isDirectory()) continue;
        const nestedPath = path.join(top, nested.name);
        if (existsSync(path.join(nestedPath, "index.ts"))) roots.push(toPosix(path.relative(root, nestedPath)));
      }
    }
    return roots.sort((left, right) => right.length - left.length);
  }

  function collectSourceFiles(directoryPath) {
    const files = [];
    for (const entry of entries(directoryPath)) {
      if (skip.includes(entry.name)) continue;
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) files.push(...collectSourceFiles(entryPath));
      else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) files.push(entryPath);
    }
    return files;
  }
}

function collectFeatureDirs(directoryPath) {
  const dirs = [];
  for (const entry of entries(directoryPath)) {
    if (!entry.isDirectory() || entry.name === "node_modules") continue;
    const entryPath = path.join(directoryPath, entry.name);
    dirs.push(entryPath, ...collectFeatureDirs(entryPath));
  }
  return dirs;
}

// depth 1 or 2 keeps nested view groups (features/vehicles/views/new/<phase>/views) out of scope
function collectFeatureLeaves(directoryPath) {
  const hasViews = (dir) => existsSync(path.join(dir, "views")) && statSync(path.join(dir, "views")).isDirectory();
  const leaves = [];
  for (const entry of entries(directoryPath)) {
    if (!entry.isDirectory()) continue;
    const level1 = path.join(directoryPath, entry.name);
    if (hasViews(level1)) leaves.push(level1);
    for (const nested of entries(level1)) {
      if (!nested.isDirectory()) continue;
      const level2 = path.join(level1, nested.name);
      if (hasViews(level2)) leaves.push(level2);
    }
  }
  return leaves;
}

function extractImportSpecifiers(fileContent) {
  const specifiers = new Set();
  const patterns = [
    /import\s+(?:[^"'`]*?\sfrom\s*)?["'`]([^"'`]+)["'`]/g,
    /import\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
    // re-exports reach a module as much as imports do
    /export\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s*from\s*["'`]([^"'`]+)["'`]/g,
  ];
  for (const pattern of patterns) {
    for (const match of fileContent.matchAll(pattern)) {
      if (match[1]) specifiers.add(match[1]);
    }
  }
  return [...specifiers];
}
