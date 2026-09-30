import { inject, provide, type App } from "vue";
import { defineFeatureContext } from "../platform/context";
import type { IconSet } from "./index";

/**
 * The icon set of the app (or of a subtree): installed once, overridable below. Unlike most
 * contexts it is optional: the library's own icons need no installation.
 */
export const [iconSetKey] = defineFeatureContext<IconSet>("vue-core.icons");

/** Installs the app's icons; `Icon` looks a name up here first, then in the library's own set. */
export function installIcons(app: App, icons: IconSet): void {
  app.provide(iconSetKey, icons);
}

/** Overrides the icon set for the component subtree below the caller. */
export function provideIcons(icons: IconSet): void {
  provide(iconSetKey, icons);
}

/** The installed set, or an empty one when the app installed none. */
export function useIconSet(): Readonly<Record<string, string | undefined>> {
  return inject(iconSetKey, {}) as Readonly<Record<string, string | undefined>>;
}
