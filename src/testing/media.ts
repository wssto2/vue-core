/** What the mocked `matchMedia` answers. */
export interface MediaState {
  /** Phones and touch-first screens (the `compact:` condition). */
  compact: boolean;
  reducedMotion: boolean;
}

/**
 * Replaces `window.matchMedia` for a test: the library's two conditions are answered from
 * `state`, everything else is false. Change `state` through `set` to fire `change` listeners.
 * Returns `restore`. Not public; tests only.
 */
export function mockMedia(initial: Partial<MediaState> = {}) {
  const state: MediaState = { compact: false, reducedMotion: false, ...initial };
  const original = window.matchMedia;
  const lists = new Set<{ query: string; last: boolean; listeners: Set<() => void> }>();

  const evaluate = (query: string) =>
    query.includes("prefers-reduced-motion") ? state.reducedMotion : query.includes("pointer: coarse") ? state.compact : false;

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
