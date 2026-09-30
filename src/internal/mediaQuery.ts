import { getCurrentScope, onScopeDispose, ref, type Ref } from "vue";

/** Tracks a CSS media query. False where there is no `matchMedia` (server, some test runners). */
export function useMediaQuery(query: string): Ref<boolean> {
  const matches = ref(false);
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return matches;

  const list = window.matchMedia(query);
  matches.value = list.matches;
  const update = () => {
    matches.value = list.matches;
  };
  list.addEventListener("change", update);
  if (getCurrentScope()) onScopeDispose(() => list.removeEventListener("change", update));

  return matches;
}

/**
 * Phones and touch-first screens: the same condition as the `compact:` Tailwind variant and the
 * compact type and row tokens. Overlays switch presentation on it (dialog or page sheet, alert
 * or action sheet).
 */
export const COMPACT_MEDIA_QUERY = "(max-width: 47.999rem), (pointer: coarse)";

export function useCompactPresentation(): Ref<boolean> {
  return useMediaQuery(COMPACT_MEDIA_QUERY);
}
