import { onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from "vue";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A number that counts up to its value when the value arrives (UI decision D23: a result
 * revealed, such as a price that was being calculated). Only a change from nothing (0) counts; a
 * later change, and any change under reduced motion, shows at once.
 *
 *   const shown = useCountUp(() => quote.value?.total ?? 0);   // <span>{{ format.money(shown) }}</span>
 */
export function useCountUp(target: MaybeRefOrGetter<number>, durationMs = 700) {
  const shown = ref(toValue(target));
  let frame = 0;

  function cancel() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  watch(() => toValue(target), (to, from) => {
    cancel();
    if (from !== 0 || to === 0 || prefersReducedMotion() || typeof requestAnimationFrame === "undefined") {
      shown.value = to;
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      shown.value = Math.round(to * (1 - Math.pow(1 - progress, 3)));
      frame = progress < 1 ? requestAnimationFrame(step) : 0;
    };
    shown.value = 0;
    frame = requestAnimationFrame(step);
  });

  onScopeDispose(cancel);

  return shown;
}
