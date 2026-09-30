import { inject, provide, type App, type InjectionKey } from "vue";
import type { IconSet } from "./index";

/** The icon set of the app (or of a subtree): installed once, overridable below. */
export const iconSetKey: InjectionKey<IconSet> = Symbol("vue-core:icons");

/** Installs the app's icons; `Icon` looks a name up here first, then in the library's own set. */
export function installIcons(app: App, icons: IconSet): void {
  app.provide(iconSetKey, icons);
}

/** Overrides the icon set for the component subtree below the caller. */
export function provideIcons(icons: IconSet): void {
  provide(iconSetKey, icons);
}

/** The installed set, or an empty one: the library's own icons need no installation. */
export function useIconSet(): Readonly<Record<string, string | undefined>> {
  return inject(iconSetKey, {}) as Readonly<Record<string, string | undefined>>;
}
