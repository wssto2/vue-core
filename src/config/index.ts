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
export type ArchitectureConfig = Record<string, unknown>;
export type GeneratorConfig = Record<string, unknown>;
export type E2eTimingsConfig = Record<string, unknown>;

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
