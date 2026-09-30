/**
 * The public bootstrap config: a JSON object the server embeds in the page
 * (`<script id="app-state" type="application/json">`), read once at startup. Only what every go-core
 * application has lives here; an application's own values (its market, currency, feature flags) are
 * a section it validates itself through `extend`. Nothing secret belongs in it: it is in the page source.
 */
export interface BootstrapConfig {
  /** Prefix of the API, e.g. `/api/v1`; empty when the API is at the origin root. Wire key `api_base`. */
  apiBase: string;
  /** The locale the server chose for this page, e.g. `hr`. */
  locale: string;
  /** Wire key `app_name`. */
  appName: string | null;
  /** What the backend reports it can do (feature names); a capability is not a user's permission. */
  capabilities: readonly string[];
}

/** Thrown for a missing, unreadable or invalid bootstrap config; `issues` names every problem found. */
export class BootstrapError extends Error {
  readonly issues: readonly string[];
  readonly cause: unknown;

  constructor(message: string, issues: readonly string[] = [], options?: { cause?: unknown }) {
    super(issues.length > 0 ? `${message}: ${issues.join("; ")}` : message);
    this.name = "BootstrapError";
    this.issues = issues;
    this.cause = options?.cause;
  }
}

const describeType = (value: unknown) => (value === null ? "null" : Array.isArray(value) ? "array" : typeof value);
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Typed, validating reads of one object of the config. Each read either returns the value, returns
 * the fallback you gave for an absent key, or records an issue; all issues are reported together
 * (`BootstrapError`) when parsing ends, so one run shows every mistake.
 */
export class BootstrapFields {
  readonly #source: Record<string, unknown>;
  readonly #path: string;
  readonly #issues: string[];
  readonly #quiet: boolean;

  /** @internal use the `fields` passed to `extend`. */
  constructor(source: Record<string, unknown>, path: string, issues: string[], quiet = false) {
    this.#source = source;
    this.#path = path;
    this.#issues = issues;
    this.#quiet = quiet;
  }

  /** Records a problem with `key`; for values `raw` returns that the application validates itself. */
  fail(key: string, message: string): void {
    if (!this.#quiet) this.#issues.push(`${this.#path}${key}: ${message}`);
  }

  /** The value as sent, unchecked. Validate it and report with `fail`. */
  raw(key: string): unknown {
    return this.#source[key];
  }

  string(key: string): string;
  string<F extends string | null>(key: string, fallback: F): string | F;
  string(key: string, ...fallback: [] | [string | null]): string | null {
    return this.#read(key, "string", (value): value is string => typeof value === "string", fallback);
  }

  number(key: string): number;
  number<F extends number | null>(key: string, fallback: F): number | F;
  number(key: string, ...fallback: [] | [number | null]): number | null {
    return this.#read(key, "number", (value): value is number => typeof value === "number" && Number.isFinite(value), fallback);
  }

  boolean(key: string): boolean;
  boolean<F extends boolean>(key: string, fallback: F): boolean | F;
  boolean(key: string, ...fallback: [] | [boolean]): boolean | null {
    return this.#read(key, "boolean", (value): value is boolean => typeof value === "boolean", fallback);
  }

  stringList(key: string): readonly string[];
  stringList<F extends readonly string[]>(key: string, fallback: F): readonly string[] | F;
  stringList(key: string, ...fallback: [] | [readonly string[]]): readonly string[] | null {
    return this.#read(
      key,
      "array of strings",
      (value): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string"),
      fallback,
    );
  }

  /** A nested object, read with the same checks; issues are reported as `parent.child`. */
  section(key: string): BootstrapFields {
    const value = this.#source[key];
    if (!isObject(value)) {
      this.fail(key, `expected object, got ${describeType(value)}`);
      return new BootstrapFields({}, `${this.#path}${key}.`, this.#issues, true); // one issue for the missing object, not one per read
    }
    return new BootstrapFields(value, `${this.#path}${key}.`, this.#issues);
  }

  #read<T, F>(key: string, expected: string, accepts: (value: unknown) => value is T, fallback: [] | [F]): T | F | null {
    const value = this.#source[key];
    if (value === undefined && fallback.length > 0) return fallback[0] as F;
    if (accepts(value)) return value;
    this.fail(key, `expected ${expected}, got ${value === undefined ? "nothing (missing)" : describeType(value)}`);
    return null;
  }
}

/**
 * Validates a bootstrap object. `extend` reads the application's own section and returns it; the
 * result is the shared config with that section merged in, typed from what `extend` returns.
 */
export function parseBootstrap<T extends object = Record<never, never>>(
  raw: unknown,
  extend?: (fields: BootstrapFields) => T,
): BootstrapConfig & T {
  if (!isObject(raw)) {
    throw new BootstrapError("Invalid bootstrap config", [`expected a JSON object, got ${describeType(raw)}`]);
  }
  const issues: string[] = [];
  const fields = new BootstrapFields(raw, "", issues);

  const locale = fields.string("locale");
  if (locale === "") fields.fail("locale", "must not be empty");
  const shared: BootstrapConfig = {
    apiBase: fields.string("api_base", ""),
    locale,
    appName: fields.string("app_name", null),
    capabilities: fields.stringList("capabilities", []),
  };
  const own = extend?.(fields) ?? ({} as T);

  if (issues.length > 0) throw new BootstrapError("Invalid bootstrap config", issues);
  return { ...own, ...shared };
}

export interface ReadBootstrapOptions<T extends object> {
  /** The element holding the JSON, or its id. Default `app-state`. */
  element?: string | Element;
  extend?: (fields: BootstrapFields) => T;
}

/** Reads the embedded JSON and validates it with `parseBootstrap`. Call it once, in your composition root. */
export function readBootstrap<T extends object = Record<never, never>>(
  options: ReadBootstrapOptions<T> = {},
): BootstrapConfig & T {
  const { element = "app-state", extend } = options;
  const node = typeof element === "string" ? document.getElementById(element) : element;
  const label = typeof element === "string" ? `#${element}` : "the given element";
  if (!node) {
    throw new BootstrapError(
      `Bootstrap config not found: the page has no ${label} element (expected <script id="app-state" type="application/json">)`,
    );
  }
  const json = node.textContent?.trim() ?? "";
  if (json === "") throw new BootstrapError(`Bootstrap config is empty: ${label} has no content`);
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (cause) {
    throw new BootstrapError(`Bootstrap config in ${label} is not valid JSON`, [], { cause });
  }
  return parseBootstrap(raw, extend);
}
