import type { MessageNamespace, Messages } from "./messages";

/** The part of a vue-i18n composer (`i18n.global`) the runtime writes to. */
export interface MessageTarget {
  locale: { value: string };
  mergeLocaleMessage(locale: string, message: Record<string, unknown>): void;
}

export interface MessageFailure {
  readonly namespace: string;
  readonly locale: string;
  readonly error: unknown;
}

export interface MessageRuntimeOptions {
  target: MessageTarget;
  /** Every namespace of the application, unique by name (the application validates that). */
  namespaces: readonly MessageNamespace[];
  /** The locale whose messages stand in for a missing one. */
  fallback: string;
  /** The locales `setLocale` accepts. */
  supported: readonly string[];
  /** Called once per failed load; the load is retried the next time the namespace is needed, or by `retry()`. */
  onFailure?: (failure: MessageFailure) => void;
}

/** The loading of message namespaces for one application: on demand, once, race-safe on locale switches. */
export interface MessageRuntime {
  /** Loads the namespaces for the active locale and the fallback. Never rejects; failures go to `onFailure` and stay retryable. */
  load(namespaces: readonly string[]): Promise<void>;
  /** Loads the `essential` namespaces; resolves with what failed. */
  loadEssential(): Promise<readonly MessageFailure[]>;
  /**
   * Switches the locale after the messages this application already uses exist in it, so nothing
   * shows a raw key. Resolves true when the switch was committed, false when a later call (or
   * `dispose`) superseded it: a late load for a locale nobody wants any more never changes anything.
   * Rejects for a locale the application does not support.
   */
  setLocale(locale: string): Promise<boolean>;
  /** Tries every failed load again. */
  retry(): Promise<void>;
  /** Drops every late answer from now on. */
  dispose(): void;
}

const nest = (namespace: string, messages: Messages): Record<string, unknown> =>
  namespace.split(".").reduceRight<Record<string, unknown>>((inner, key) => ({ [key]: inner }), messages as Record<string, unknown>);

export function createMessageRuntime(options: MessageRuntimeOptions): MessageRuntime {
  const { target, fallback } = options;
  const registry = new Map(options.namespaces.map((entry) => [entry.namespace, entry]));
  const loaded = new Set<string>();
  const pending = new Map<string, Promise<boolean>>();
  const failed = new Map<string, MessageFailure>();
  const wanted = new Set<string>(); // every namespace this application has asked for: a new locale needs all of them
  let epoch = 0;
  let disposed = false;

  const keyOf = (locale: string, namespace: string) => `${locale}\u0000${namespace}`;

  function ensure(locale: string, namespace: string): Promise<boolean> {
    const key = keyOf(locale, namespace);
    if (loaded.has(key)) return Promise.resolve(true);
    const running = pending.get(key);
    if (running) return running;

    const loader = registry.get(namespace)?.loaders[locale];
    if (!loader) return Promise.resolve(true); // nothing to load in this locale: the fallback's messages stand in

    failed.delete(key);
    const attempt = loader().then(
      (module) => {
        if (disposed) return false;
        target.mergeLocaleMessage(locale, nest(namespace, module.default));
        loaded.add(key);
        return true;
      },
      (error: unknown) => {
        const failure = { namespace, locale, error };
        failed.set(key, failure);
        if (!disposed) options.onFailure?.(failure);
        return false;
      },
    ).finally(() => pending.delete(key));
    pending.set(key, attempt);
    return attempt;
  }

  const localesFor = (locale: string) => (locale === fallback ? [locale] : [locale, fallback]);

  async function loadFor(locale: string, namespaces: Iterable<string>): Promise<boolean> {
    const results = await Promise.all([...namespaces].flatMap((namespace) => localesFor(locale).map((each) => ensure(each, namespace))));
    return results.every(Boolean);
  }

  return {
    async load(namespaces) {
      for (const namespace of namespaces) wanted.add(namespace);
      await loadFor(target.locale.value, namespaces);
    },

    async loadEssential() {
      const essential = options.namespaces.filter((entry) => entry.essential).map((entry) => entry.namespace);
      for (const namespace of essential) wanted.add(namespace);
      await loadFor(target.locale.value, essential);
      return [...failed.values()].filter((failure) => essential.includes(failure.namespace));
    },

    async setLocale(locale) {
      if (!options.supported.includes(locale)) throw new RangeError(`Unsupported locale "${locale}"; this application supports ${options.supported.join(", ")}.`);
      const mine = ++epoch;
      // Namespaces requested while the load runs are needed in the new locale too; each is tried once.
      const tried = new Set<string>();
      for (;;) {
        const todo = [...wanted].filter((namespace) => !tried.has(namespace));
        if (todo.length === 0) break;
        for (const namespace of todo) tried.add(namespace);
        await loadFor(locale, todo);
        if (epoch !== mine || disposed) return false;
      }
      if (epoch !== mine || disposed) return false;
      target.locale.value = locale;
      return true;
    },

    async retry() {
      const again = [...failed.values()];
      failed.clear();
      await Promise.all(again.map((failure) => ensure(failure.locale, failure.namespace)));
    },

    dispose() {
      disposed = true;
      epoch++;
    },
  };
}
