import type { Ref, ShallowRef } from "vue";
import { defineFeatureContext } from "../platform/context";

/**
 * Where the application is in its start. A failed start is one of three kinds, never mixed up: the
 * session could not be checked (the server is unreachable), the essential texts could not be loaded,
 * or something else stopped the first navigation. (A missing or invalid bootstrap config never gets
 * here: `readBootstrap` throws `BootstrapError` before the application exists.)
 */
export type ApplicationState =
  | { readonly status: "idle" }
  | { readonly status: "starting" }
  | { readonly status: "ready" }
  | { readonly status: "failed"; readonly kind: "session" | "messages" | "startup"; readonly error: unknown };

/** What components may ask of their application. */
export interface ApplicationEnvironment {
  readonly state: Readonly<ShallowRef<ApplicationState>>;
  /** The active locale. */
  readonly locale: Readonly<Ref<string>>;
  readonly locales: readonly string[];
  /** Switches the locale once the texts in use exist in it; see `MessageRuntime.setLocale`. */
  setLocale(locale: string): Promise<boolean>;
  /** Tries the start again after a failed one. */
  retry(): Promise<void>;
}

export const [applicationKey, useApplication] = defineFeatureContext<ApplicationEnvironment>("vue-core.application");
