// The shape of `vue-core.config.mjs`, the one file the `vue-core` command reads (bin/config.mjs loads
// and validates it). Each command owns one section; the command that fills a section replaces its type.
export type LintConfig = Record<string, unknown>;
export type ArchitectureConfig = Record<string, unknown>;
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
