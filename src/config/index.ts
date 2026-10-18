// The shape of `vue-core.config.mjs`, the one file the `vue-core` command reads (bin/config.mjs loads
// and validates it). Each command owns one section; the command that fills a section replaces its type.
export type LintConfig = Record<string, unknown>;
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
