import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";

/** How far the finger must pull (after resistance) for a release to refresh. */
export const PULL_THRESHOLD = 72;
const MAX_PULL = 110;
const RESISTANCE = 0.5;
/** The indicator stays up at least this long, so a fast reload still reads as "it refreshed". */
const MIN_SPIN = 600;

/**
 * Pull down from the top of the page to refresh: what an installed app gets from neither iOS nor Android's browser chrome.
 * Only a vertical, downward drag that starts with the page scrolled to the top counts; `enabled` says when a drag may start
 * at all (installed, signed in, no dialog or drawer open). Past `PULL_THRESHOLD` on release it runs `onRefresh`.
 *
 *   const { pull, refreshing } = usePullToRefresh(reload, { enabled: () => installed.value });
 */
export function usePullToRefresh(
  onRefresh: () => Promise<unknown> | unknown,
  options: { enabled: () => boolean },
): { pull: Ref<number>; refreshing: Ref<boolean> } {
  const pull = ref(0);
  const refreshing = ref(false);

  let startX = 0;
  let startY = 0;
  let tracking = false;

  function onTouchStart(event: TouchEvent) {
    tracking = false;
    if (!options.enabled() || refreshing.value || event.touches.length !== 1 || window.scrollY > 0) return;
    startX = event.touches[0]!.clientX;
    startY = event.touches[0]!.clientY;
    tracking = true;
  }

  function onTouchMove(event: TouchEvent) {
    if (!tracking) return;
    const dx = event.touches[0]!.clientX - startX;
    const dy = event.touches[0]!.clientY - startY;
    // Sideways (a carousel, a table scrolling horizontally) or upwards: not a pull.
    if (dy <= 0 || Math.abs(dx) > dy || window.scrollY > 0) {
      if (pull.value === 0) tracking = false;
      pull.value = 0;
      return;
    }
    pull.value = Math.min(MAX_PULL, dy * RESISTANCE);
  }

  async function onTouchEnd() {
    if (!tracking) return;
    tracking = false;
    if (pull.value < PULL_THRESHOLD) {
      pull.value = 0;
      return;
    }
    refreshing.value = true;
    pull.value = PULL_THRESHOLD;
    try {
      await Promise.all([onRefresh(), new Promise((resolve) => setTimeout(resolve, MIN_SPIN))]);
    } finally {
      refreshing.value = false;
      pull.value = 0;
    }
  }

  onMounted(() => {
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
  });
  onBeforeUnmount(() => {
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("touchcancel", onTouchEnd);
  });

  return { pull, refreshing };
}
