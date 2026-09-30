import { shallowRef, type ShallowRef } from "vue";
import { WAIT_VISIBLE_AFTER_MS } from "../state/useWaitStatus";

/** The page-load indicator of one shell: `start` / `done` are what `createApplication`'s `router.progress` takes. */
export interface NavigationProgress {
  /** Whether the bar shows: a wait shows nothing for its first 0.3 s, so a fast navigation does not flicker (UI decision D23). */
  readonly visible: Readonly<ShallowRef<boolean>>;
  start(): void;
  done(): void;
}

export function createNavigationProgress(delayMs = WAIT_VISIBLE_AFTER_MS): NavigationProgress {
  const visible = shallowRef(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    visible,
    start() {
      clearTimeout(timer);
      timer = setTimeout(() => (visible.value = true), delayMs);
    },
    done() {
      clearTimeout(timer);
      timer = undefined;
      visible.value = false;
    },
  };
}
