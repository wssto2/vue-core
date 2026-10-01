/** What the mocked `matchMedia` answers. */
export interface MediaState {
  /** Phones and touch-first screens (the `compact:` condition). */
  compact: boolean;
  /** Below 1024 px, phones and tablets: where lists turn into phone rows. */
  narrow: boolean;
  reducedMotion: boolean;
  /** Running as an installed app (`display-mode: standalone`). */
  standalone: boolean;
}

/**
 * Replaces `window.matchMedia` for a test: the library's conditions (compact, narrow, reduced motion, standalone) are answered from
 * `state`, everything else is false. Change `state` through `set` to fire `change` listeners.
 * Returns `restore`: call it in `afterEach`.
 *
 *   const media = mockMedia({ compact: true });
 *   afterEach(() => media.restore());
 */
export function mockMedia(initial: Partial<MediaState> = {}) {
  const state: MediaState = { compact: false, narrow: false, reducedMotion: false, standalone: false, ...initial };
  const original = window.matchMedia;
  const lists = new Set<{ query: string; last: boolean; listeners: Set<() => void> }>();

  // A media list is true when any of its comma-separated queries is.
  const evaluatePart = (query: string) =>
    query.includes("prefers-reduced-motion")
      ? state.reducedMotion
      : query.includes("display-mode: standalone")
        ? state.standalone
        : query.includes("min-width: 48rem")
          ? !state.compact
          : query.includes("max-width: 1023px")
            ? state.narrow || state.compact
            : query.includes("pointer: coarse") || query.includes("max-width: 47.999rem")
              ? state.compact
              : false;
  const evaluate = (query: string) => query.split(",").some(evaluatePart);

  window.matchMedia = ((query: string) => {
    const entry = { query, last: evaluate(query), listeners: new Set<() => void>() };
    lists.add(entry);
    return {
      media: query,
      get matches() {
        return evaluate(query);
      },
      addEventListener: (_type: string, listener: () => void) => entry.listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => entry.listeners.delete(listener),
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;

  return {
    state,
    set(next: Partial<MediaState>) {
      Object.assign(state, next);
      for (const entry of lists) {
        const now = evaluate(entry.query);
        if (now !== entry.last) {
          entry.last = now;
          entry.listeners.forEach((listener) => listener());
        }
      }
    },
    restore() {
      window.matchMedia = original;
    },
  };
}
