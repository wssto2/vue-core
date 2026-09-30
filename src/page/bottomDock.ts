import { ref, type App, type Ref } from "vue";
import { defineFeatureContext } from "../platform/context";

/**
 * The element bars pinned to the bottom edge are teleported into: a reference the app installs
 * once and the `BottomDock` component fills in when it mounts (the dock is a sibling of the pages,
 * not an ancestor, so it cannot provide itself to them).
 */
export const [bottomDockKey, useBottomDockTarget] = defineFeatureContext<Ref<HTMLElement | null>>("vue-core.bottomDock");

/** Installs the bottom dock context for an app; render `<BottomDock />` once at the root. */
export function installBottomDock(app: App): Ref<HTMLElement | null> {
  const target = ref<HTMLElement | null>(null);
  app.provide(bottomDockKey, target);
  return target;
}
