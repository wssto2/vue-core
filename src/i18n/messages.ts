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
  /** The loaders of an `import.meta.glob("./*.json")`, by path; their locale is known only with the application's `localeFiles` (`messageLoaders`). */
  readonly files: Readonly<Record<string, MessageLoader>>;
  /** Loaded before the application first renders (the shell's own texts), not on demand. */
  readonly essential: boolean;
}

export interface LocaleMessagesOptions {
  /** Default false: loaded when a route of the owning feature is entered. */
  essential?: boolean;
}

/** Which file name holds a locale's messages when it differs from the locale (`{ bs: "ba" }`: `ba.json` is Bosnian). */
export type LocaleFiles = Readonly<Record<string, string>>;

const FILE = /(?:^|\/)([^/]+)\.json$/;

/** The loaders of a namespace by locale: the explicit ones, plus each glob file under its locale (the file name, or the locale `localeFiles` maps to it). */
export function messageLoaders(entry: MessageNamespace, localeFiles: LocaleFiles = {}): Readonly<Record<string, MessageLoader>> {
  const localeOf = new Map(Object.entries(localeFiles).map(([locale, file]) => [file, locale]));
  const loaders: Record<string, MessageLoader> = {};
  for (const [path, loader] of Object.entries(entry.files)) {
    const file = FILE.exec(path)![1]!;
    loaders[localeOf.get(file) ?? file] = loader;
  }
  return { ...loaders, ...entry.loaders };
}

const NAMESPACE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/i;

/**
 * Binds a message namespace to its files, one lazy loader per locale:
 *
 *   localeMessages("tickets", { en: () => import("./i18n/en.json"), hr: () => import("./i18n/hr.json") })
 *   localeMessages("tickets", import.meta.glob("./i18n/*.json"))   // lazy; file names are locales, or via createApplication({ localeFiles })
 *
 * Nothing loads until the runtime needs it. Use the lazy glob, never `{ eager: true }`. `core` belongs to the library.
 */
export function localeMessages(namespace: string, loaders: Readonly<Record<string, MessageLoader>>, options?: LocaleMessagesOptions): MessageNamespace;
/** The lazy `import.meta.glob("./*.json")` of the namespace's folder (its values are typed `unknown` by Vite; the files are the messages). */
export function localeMessages(namespace: string, files: Readonly<Record<`${string}.json`, () => Promise<unknown>>>, options?: LocaleMessagesOptions): MessageNamespace;
export function localeMessages(namespace: string, loaders: Readonly<Record<string, () => Promise<unknown>>>, options: LocaleMessagesOptions = {}): MessageNamespace {
  if (!NAMESPACE.test(namespace)) throw new Error(`localeMessages: "${namespace}" is not a namespace (words joined by dots, e.g. "tickets" or "crm.lead").`);
  if (namespace === "core" || namespace.startsWith("core.")) throw new Error(`localeMessages: the "core" namespace belongs to the library; choose another name than "${namespace}".`);
  const glob = Object.keys(loaders).length > 0 && Object.keys(loaders).every((key) => key.endsWith(".json"));
  return { namespace, loaders: glob ? {} : { ...(loaders as Record<string, MessageLoader>) }, files: glob ? { ...(loaders as Record<string, MessageLoader>) } : {}, essential: options.essential === true };
}
