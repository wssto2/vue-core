import { onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from "vue";

/** Below this a wait shows nothing, so a fast answer does not flicker (UI decision D23). */
export const WAIT_VISIBLE_AFTER_MS = 300;
/** How long a sheet shows "Saved" on its primary action before it closes (D23). */
export const DONE_BEAT_MS = 600;

/**
 * The clock of one wait (UI decision D23): whether it has lasted long enough to show (`visible`,
 * after 0.3 s), how many whole seconds it has run (`elapsed`), and whether it is slower than
 * usual (`slow`, after `slowAfterMs`). It restarts each time `busy` turns on.
 *
 *   const wait = useWaitStatus(() => busy.value, { slowAfterMs: 6000 });
 *   <StatusLine v-if="wait.visible.value" :text="…" :elapsed="wait.slow.value ? wait.elapsed.value : null" />
 */
export function useWaitStatus(busy: MaybeRefOrGetter<boolean>, options: { slowAfterMs?: number } = {}) {
  const visible = ref(false);
  const elapsed = ref(0);
  const slow = ref(false);
  let timers: ReturnType<typeof setTimeout>[] = [];
  let tick: ReturnType<typeof setInterval> | null = null;

  function stop() {
    timers.forEach((timer) => clearTimeout(timer));
    timers = [];
    if (tick) clearInterval(tick);
    tick = null;
  }

  function start() {
    stop();
    visible.value = false;
    elapsed.value = 0;
    slow.value = false;
    timers.push(setTimeout(() => (visible.value = true), WAIT_VISIBLE_AFTER_MS));
    if (options.slowAfterMs) timers.push(setTimeout(() => (slow.value = true), options.slowAfterMs));
    tick = setInterval(() => (elapsed.value += 1), 1000);
  }

  watch(
    () => toValue(busy),
    (on) => {
      if (on) start();
      else {
        stop();
        visible.value = false;
        slow.value = false;
      }
    },
    { immediate: true },
  );

  onScopeDispose(stop);

  return { visible, elapsed, slow };
}
