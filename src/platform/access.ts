/** Whose records a grant reaches, as go-core's authz reports it. */
export type AccessQualifier = "own" | "own_location" | "all";

/** Where a grant applies: a level of the application's scope hierarchy (`organization`, `dealer`, ...) and an optional id. */
export interface AccessScope {
  readonly level: string;
  readonly id?: number;
}

/** One way a permission is held (a role bound at a scope). */
export interface AccessClause {
  readonly scope: AccessScope;
  readonly qualifier: AccessQualifier;
  /** The role the grant comes from, when the server says. */
  readonly role?: string;
}

/** How one permission is held: the widest scope, the widest qualifier, and each clause behind them. */
export interface HeldAccess {
  readonly scope: AccessScope;
  readonly qualifier: AccessQualifier;
  readonly clauses: readonly AccessClause[];
}

/** What the session may do (go-core's `/me/access` payload), keyed by permission identifier. */
export interface AccessSnapshot {
  /** Some binding of the user is at the root scope (above every tenant). */
  readonly root: boolean;
  readonly permissions: Readonly<Record<string, HeldAccess>>;
  /** Granted by a role but switched off for this tenant: not held. */
  readonly unavailable: readonly string[];
}

/**
 * Reads what the signed-in user may do. `P` is the application's permission identifiers, typically the
 * union generated from the backend's catalogue: a platform's `access` is an `AccessClient<string>`, and
 * `const access: AccessClient<AppPermission> = platform.access` narrows it (a typo in `can("...")` then
 * fails to compile; the wire data stays unchecked, which is the safe direction).
 Every method reads reactive session state, so it is safe in
 * templates and `computed`. Before a session answers, or when signed out, nothing is held.
 * The server still authorizes every operation: this only decides what to offer.
 */
export interface AccessClient<P extends string = string> {
  /** Some binding is at the root scope (ARV's `atOrganization`). */
  readonly root: boolean;
  /** Whether `permission` is held; with `scope`, whether some grant of it reaches that scope. */
  can(permission: P, scope?: AccessScope): boolean;
  /** Whether at least one of the permissions is held. */
  canAny(permissions: readonly P[]): boolean;
  /** Whether every one of the permissions is held (true for none). */
  canAll(permissions: readonly P[]): boolean;
  /** How the permission is held (widest scope and qualifier), or null when it is not held. */
  held(permission: P): HeldAccess | null;
}

export interface AccessClientOptions {
  /**
   * Whether a grant at `held` reaches `asked`. The client does not know your scope hierarchy
   * (location inside dealer inside organization), so the default is an exact match of level and id;
   * supply this to honour containment.
   */
  covers?: (held: AccessScope, asked: AccessScope) => boolean;
}

const sameScope = (held: AccessScope, asked: AccessScope) => held.level === asked.level && held.id === asked.id;

// `in` and plain lookups see Object.prototype ("constructor", "toString"): a permission named like
// that would count as held. ARV's isHeld used `in`.
const own = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);

/** An `AccessClient` reading whatever snapshot `source` returns at call time (null: nothing is held). */
export function createAccessClient<P extends string = string>(
  source: () => AccessSnapshot | null,
  options: AccessClientOptions = {},
): AccessClient<P> {
  const covers = options.covers ?? sameScope;

  function held(permission: P): HeldAccess | null {
    const snapshot = source();
    if (!snapshot || !own(snapshot.permissions, permission) || snapshot.unavailable.includes(permission)) return null;
    return snapshot.permissions[permission] ?? null;
  }

  function can(permission: P, scope?: AccessScope): boolean {
    const access = held(permission);
    if (!access) return false;
    if (!scope) return true;
    const scopes = access.clauses.length > 0 ? access.clauses.map((clause) => clause.scope) : [access.scope];
    return scopes.some((candidate) => covers(candidate, scope));
  }

  return {
    get root() {
      return source()?.root ?? false;
    },
    can,
    canAny: (permissions) => permissions.some((permission) => can(permission)),
    canAll: (permissions) => permissions.every((permission) => can(permission)),
    held,
  };
}

const QUALIFIERS: readonly string[] = ["own", "own_location", "all"];
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function readScope(value: unknown, path: string, issues: string[]): AccessScope {
  if (!isObject(value) || typeof value.level !== "string") {
    issues.push(`${path}: expected { level: string, id?: number }`);
    return { level: "" };
  }
  if (value.id !== undefined && typeof value.id !== "number") issues.push(`${path}.id: expected number`);
  return typeof value.id === "number" ? { level: value.level, id: value.id } : { level: value.level };
}

function readQualifier(value: unknown, path: string, issues: string[]): AccessQualifier {
  if (typeof value === "string" && QUALIFIERS.includes(value)) return value as AccessQualifier;
  issues.push(`${path}: expected one of ${QUALIFIERS.join(", ")}`);
  return "own";
}

/** Validates a `/me/access` payload; returns the snapshot and every problem found (empty when valid). */
export function parseAccessSnapshot(raw: unknown): { snapshot: AccessSnapshot; issues: string[] } {
  const issues: string[] = [];
  const permissions: Record<string, HeldAccess> = {};
  const empty: AccessSnapshot = { root: false, permissions: {}, unavailable: [] };
  if (!isObject(raw)) return { snapshot: empty, issues: ["access: expected an object"] };
  if (!isObject(raw.permissions)) issues.push("access.permissions: expected an object");
  else {
    for (const [name, value] of Object.entries(raw.permissions)) {
      const path = `access.permissions.${name}`;
      if (!isObject(value)) {
        issues.push(`${path}: expected an object`);
        continue;
      }
      const clauses = (Array.isArray(value.clauses) ? value.clauses : []).map((clause: unknown, index): AccessClause => {
        const clausePath = `${path}.clauses[${index}]`;
        if (!isObject(clause)) {
          issues.push(`${clausePath}: expected an object`);
          return { scope: { level: "" }, qualifier: "own" };
        }
        const read = { scope: readScope(clause.scope, `${clausePath}.scope`, issues), qualifier: readQualifier(clause.qualifier, `${clausePath}.qualifier`, issues) };
        return typeof clause.role === "string" ? { ...read, role: clause.role } : read;
      });
      permissions[name] = {
        scope: readScope(value.scope, `${path}.scope`, issues),
        qualifier: readQualifier(value.qualifier, `${path}.qualifier`, issues),
        clauses,
      };
    }
  }
  const unavailable = raw.unavailable ?? [];
  if (!Array.isArray(unavailable) || !unavailable.every((item) => typeof item === "string")) {
    issues.push("access.unavailable: expected an array of strings");
  }
  return {
    snapshot: {
      root: raw.root === true,
      permissions,
      unavailable: Array.isArray(unavailable) ? unavailable.filter((item): item is string => typeof item === "string") : [],
    },
    issues,
  };
}
