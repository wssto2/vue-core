// The shape of `vue-core.config.mjs`, the one file the `vue-core` command reads (bin/config.mjs loads
// and validates it). Each command owns one section; the command that fills a section replaces its type.
/** A debt ESLint cannot count itself (an inline `eslint-disable` is invisible to the rule it silences), ratcheted like a rule. */
export interface LintPatternCounter {
  /** The key in the baseline file and the line in the report. */
  name: string;
  /** File extensions scanned, with the dot: `[".vue", ".ts"]`. */
  extensions: string[];
  /** Matched line by line; give it the `g` flag. */
  pattern: RegExp;
  /** Printed beside every match in `--report` and in a ratchet failure. */
  hint: string;
}

export interface LintConfig {
  /** The baseline file, relative to the config file's folder. Default `scripts/lint-baselines.json`. */
  baselines?: string;
  /** Folders (by name, anywhere in the tree) that are not scanned and whose files are never in the typed scope. Default `["generated"]`. */
  generated?: string[];
  /** Default none. */
  patternCounters?: LintPatternCounter[];
  /** What the messages tell the developer to run, for an application that wraps the command in npm scripts. Each defaults to the `vue-core lint` call. */
  commands?: { update?: string; typedUpdate?: string; typedReport?: string; typedReportAll?: string };
  /** Where raising a ceiling is decided, named in the ratchet failure ("… is a CODEOWNERS decision — see <policy>"). */
  policy?: string;
}
/** What an application's own architecture rule is given for each source file (.ts / .vue under the config's folder). */
export interface ArchitectureFile {
  /** path from the config file's folder, with `/` */
  file: string;
  content: string;
  /** the inside of the `<template>` of a .vue file, else "" */
  template: string;
  /** import / re-export specifiers, in the order they appear */
  imports: string[];
  isVue: boolean;
  /** under a tests/ folder or named *.test.* / *.spec.* */
  isTest: boolean;
}

/** An application's own rule: the messages for one file (each is prefixed with the file's path), or none. */
export type ArchitectureRule = (file: ArchitectureFile) => string[] | undefined;

/** The rule `no-hardcoded-copy`: no text in the language of the code's authors where a person reads it. */
export interface CopyRuleConfig {
  /** What the text of that language looks like: its letters and common words (matched line by line). Required. */
  pattern: RegExp;
  /** Where every string literal of a `.ts` / `<script>` and a template's `placeholder`, `title`, `aria-label` and `label` count. Default: the UI folders (`uiDirs`). Elsewhere only a template's text and the strings of `form.ts`, `*Form.ts` and `forms/` count. */
  scope?: RegExp;
  /** Words that are written in that language's letters in every language (brand names), cut out of what `scope` scans. Give it the `g` flag. */
  properNames?: RegExp;
}

/** The rule `no-route-policy`: a route names its permission in `meta.permission`, never in `policy:` / `requires:` of a `routes.ts`. */
export interface RouteAccessConfig {
  /** The session's retired list of permission names (`policies`): `authStore.<name>` and `state.<name>` are reported too. Default none. */
  sessionField?: string;
  /** Files (by path from the config's folder) that are not scanned: scripts, docs, e2e. Tests are never scanned. */
  exclude?: RegExp;
}

export interface ArchitectureConfig {
  /** The folder of the features, relative to the config file (default "features"). */
  featuresDir?: string;
  /** The import alias that points at the config file's folder (default `@/`). */
  alias?: string;
  /** Folders that import no feature (default components, composables). */
  sharedLayers?: string[];
  /** Folders (inside the config's folder) the walk skips, by name (default dist, generated, node_modules). */
  skip?: string[];
  /** Folders the "design-values" pack checks (default the features folder and "components"). */
  uiDirs?: string[];
  /**
   * Generated code: its folder under the alias and the subpaths code may import ("entities/*" a folder, "permissions" one module;
   * default entities, schemas, routes). `moved` maps an old import prefix to its new home (old prefix to new home, each with the alias).
   */
  generated?: { dir?: string; allowed?: string[]; moved?: Record<string, string> };
  /**
   * Known offenders that predate a rule, by rule: "deep-import" (`<file> -> <specifier>`), "raw-http", "feature-name" and
   * "feature-shape" (paths), and a pack rule's or `copy` / `routeAccess` rule's id (files; a stale entry is a violation, so the list only shrinks).
   */
  allow?: Record<string, string[]>;
  /** Opt-in rule packs: "design-values" (theme tokens) and "presentation" (use the library's components). */
  packs?: ("design-values" | "presentation")[];
  /** Switches on `no-hardcoded-copy`; its allowlist (`allow["no-hardcoded-copy"]`) is a ratchet like a pack rule's. */
  copy?: CopyRuleConfig;
  /** Switches on `no-route-policy`; its allowlist is `allow["no-route-policy"]`. */
  routeAccess?: RouteAccessConfig;
  /** The application's own rules, run on every source file. */
  rules?: ArchitectureRule[];
  /** A document to name after a rule's message, by rule: "shared-layer", "api-error" or a pack rule's id. */
  doc?: Record<string, string>;
}
export interface GeneratorConfig {
  /** The template folder (`*.tpl` files, `__FEATURE_*__` placeholders), relative to the config's folder. Default: the one shipped with vue-core. */
  template?: string;
  /** Where feature folders are made, relative to the config's folder. Default: `"features"`. */
  out?: string;
}
export interface E2eTimingsConfig {
  /** The Playwright JSON report (`reporter: [["json", { outputFile }]]`), relative to the config's folder. Default: `"e2e-timings/results.json"`. */
  report?: string;
}

export interface VueCoreConfig {
  /** `vue-core lint` */
  lint?: LintConfig;
  /** `vue-core check-architecture` */
  architecture?: ArchitectureConfig;
  /** `vue-core feature` */
  generator?: GeneratorConfig;
  /** `vue-core e2e-timings` */
  e2eTimings?: E2eTimingsConfig;
}

/** Types a `vue-core.config.mjs` (`export default defineConfig({ … })`); returns the config unchanged. */
export function defineConfig(config: VueCoreConfig): VueCoreConfig {
  return config;
}
