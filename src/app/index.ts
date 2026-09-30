export { createApplication } from "./application";
export type {
  Application,
  ApplicationI18n,
  ApplicationErrorReport,
  ApplicationI18nOptions,
  ApplicationLocaleOptions,
  ApplicationOptions,
  ApplicationRouterOptions,
  ShellDefinition,
} from "./application";
export { ShellOutlet } from "./contributions";
export { applicationKey, useApplication } from "./environment";
export type { ApplicationEnvironment, ApplicationState } from "./environment";
export { defineFeature, provideContext } from "./feature";
export type {
  AppEffect,
  AppEffectContext,
  ContextProvision,
  EffectStop,
  Feature,
  FeatureDefinition,
  FeatureEffect,
  FeatureReference,
  SessionEffect,
  SessionEffectContext,
  ShellContribution,
  ShellSlot,
  ShellSlots,
} from "./feature";
export { keepSessionAlive } from "./keepAlive";
export type { KeepSessionAliveOptions } from "./keepAlive";
export { ApplicationError } from "./validate";
export type { CompositionIssue } from "./validate";
