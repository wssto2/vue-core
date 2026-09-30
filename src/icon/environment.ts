import { inject, provide, type App } from "vue";
import { defineFeatureContext } from "../platform/context";
import type { IconSet } from "./index";

/**
 * The icon set of the app (or of a subtree): installed once, overridable below. Unlike most
 * contexts it is optional: the library's own icons need no installation.
 */
export const [iconSetKey] = defineFeatureContext<IconSet>("vue-core.icons");

/**
 * Merges partial icon sets into one. A name in two sets is an error naming both positions: two
 * features drawing the same name differently would make one of them win by import order.
 */
function mergeIconSets(sets: readonly IconSet[]): IconSet {
  const merged: Record<string, string> = {};
  const origin = new Map<string, number>();
  sets.forEach((set, index) => {
    for (const [name, source] of Object.entries(set as Record<string, string | undefined>)) {
      if (source === undefined) continue;
      const first = origin.get(name);
      if (first !== undefined) throw new Error(`[vue-core] The icon "${name}" is in two icon sets (#${first + 1} and #${index + 1}); each icon comes from one set.`);
      origin.set(name, index);
      merged[name] = source;
    }
  });
  return merged as IconSet;
}

/**
 * Installs the app's icons; `Icon` looks a name up here first, then in the library's own set. Pass
 * several partial sets (one per feature) and they are merged; a name in two of them throws.
 */
export function installIcons(app: App, ...sets: readonly IconSet[]): void {
  app.provide(iconSetKey, mergeIconSets(sets));
}

/** Adds icons for the component subtree below the caller, over the ones installed above (a name set again replaces it). */
export function provideIcons(...sets: readonly IconSet[]): void {
  provide(iconSetKey, { ...inject(iconSetKey, {}), ...mergeIconSets(sets) } as IconSet);
}

/** The installed set, or an empty one when the app installed none. */
export function useIconSet(): Readonly<Record<string, string | undefined>> {
  return inject(iconSetKey, {}) as Readonly<Record<string, string | undefined>>;
}
