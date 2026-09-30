/** One locale's messages of a namespace: what a `*.json` file holds. */
export type Messages = Readonly<Record<string, unknown>>;

/** Loads the messages of one namespace in one locale; a literal `() => import("./en.json")` is one, so the bundler splits it. */
export type MessageLoader = () => Promise<{ readonly default: Messages }>;

/**
 * The messages of one namespace: where each locale's file is loaded from. A feature declares its own
 * (`defineFeature({ messages })`); the runtime loads them when a route of that feature is entered.
 */
export interface MessageNamespace {
  /** The top key the messages live under, `t("tickets.title")`; dotted namespaces nest (`crm.lead`). */
  readonly namespace: string;
  /** The loader per locale. A locale without one falls back to the application's fallback locale. */
  readonly loaders: Readonly<Record<string, MessageLoader>>;
  /** Loaded before the application first renders (the shell's own texts), not on demand. */
  readonly essential: boolean;
}

export interface LocaleMessagesOptions {
  /** Default false: loaded when a route of the owning feature is entered. */
  essential?: boolean;
}

const NAMESPACE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/i;

/**
 * Binds a message namespace to its files, one lazy loader per locale:
 *
 *   localeMessages("tickets", { en: () => import("./i18n/en.json"), hr: () => import("./i18n/hr.json") })
 *
 * Nothing loads until the runtime needs it. `core` belongs to the library.
 */
export function localeMessages(namespace: string, loaders: Readonly<Record<string, MessageLoader>>, options: LocaleMessagesOptions = {}): MessageNamespace {
  if (!NAMESPACE.test(namespace)) throw new Error(`localeMessages: "${namespace}" is not a namespace (words joined by dots, e.g. "tickets" or "crm.lead").`);
  if (namespace === "core" || namespace.startsWith("core.")) throw new Error(`localeMessages: the "core" namespace belongs to the library; choose another name than "${namespace}".`);
  return { namespace, loaders: { ...loaders }, essential: options.essential === true };
}
