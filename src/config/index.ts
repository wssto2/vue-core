// The shape of `vue-core.config.mjs`, the one file the `vue-core` command reads (bin/config.mjs loads
// and validates it). Each command owns one section; the command that fills a section replaces its type.
export type LintConfig = Record<string, unknown>;
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
   * "feature-shape" (paths), and a pack rule's id (files; a stale entry is a violation, so the list only shrinks).
   */
  allow?: Record<string, string[]>;
  /** Opt-in rule packs: "design-values" (theme tokens) and "presentation" (use the library's components). */
  packs?: ("design-values" | "presentation")[];
  /** The application's own rules, run on every source file. */
  rules?: ArchitectureRule[];
  /** A document to name after a rule's message, by rule: "shared-layer", "api-error" or a pack rule's id. */
  doc?: Record<string, string>;
}
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
