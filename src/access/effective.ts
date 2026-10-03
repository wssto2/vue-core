import type { AccessQualifier } from "../platform";
import type { EffectiveGrant, EffectivePermission, Scope } from "../modules/access/entities";
import { groupOf, screenKeyOf, SYSTEM_GROUP, type PermissionCatalogue } from "./catalogue";

/** A role that gives a screen's permissions, with the widest whose it gives them at. */
export interface EffectiveSource {
  readonly roleKey: string;
  readonly roleName: string;
  readonly qualifier: AccessQualifier;
  readonly scope: Scope;
}

/** One permission the person holds, with every grant behind it. */
export interface EffectiveAction {
  readonly permission: string;
  readonly verb: string;
  /** Granted by a role but switched off for this tenant. */
  readonly unavailable: boolean;
  readonly grants: readonly EffectiveGrant[];
}

/** One screen: what is held of it, which roles give it, and how wide. */
export interface EffectiveScreen {
  readonly key: string;
  readonly actions: readonly EffectiveAction[];
  readonly sources: readonly EffectiveSource[];
  /** The widest whose over the screen's ownable actions; null when none of them is ownable. */
  readonly qualifier: AccessQualifier | null;
  /** Where the screen's permissions apply, each place once, the root first. */
  readonly scopes: readonly Scope[];
  readonly ownable: boolean;
  /** Every action here is switched off for the tenant. */
  readonly allUnavailable: boolean;
}

export interface EffectiveGroup {
  readonly key: string;
  readonly screens: readonly EffectiveScreen[];
}

const WIDTH: Record<AccessQualifier, number> = { own: 0, own_location: 1, all: 2 };
const wider = (a: AccessQualifier, b: AccessQualifier): AccessQualifier => (WIDTH[b] > WIDTH[a] ? b : a);
const placeKey = (scope: Scope) => `${scope.level}:${scope.id ?? ""}`;
const VERBS = ["view", "create", "update", "manage", "delete"];
const verbRank = (verb: string) => (VERBS.includes(verb) ? VERBS.indexOf(verb) : VERBS.length);

/**
 * *What a person can do*: the effective permissions by module and screen, worked out from the roles. The server sends one entry per
 * permission with every grant behind it (`EffectivePermission.grants`); this turns them into the rows the panel shows: a screen with the
 * actions held, the roles that give them, and how wide (whose records, which places). A permission the catalogue does not know (a role
 * saved before it was removed) is grouped by its module and shown by its identifier.
 */
export function groupEffective(catalogue: PermissionCatalogue, effective: readonly EffectivePermission[], rootLevel: string): readonly EffectiveGroup[] {
  const groups = new Map<string, Map<string, EffectiveScreen & { actions: EffectiveAction[]; sources: EffectiveSource[]; scopes: Scope[] }>>();

  for (const entry of effective) {
    if (entry.grants.length === 0) continue;
    const meta = catalogue[entry.permission];
    const [namespace = entry.permission, verb = ""] = entry.permission.split(":");
    const group = meta ? groupOf(meta) : (namespace.split(".")[0] ?? namespace);
    const key = meta ? screenKeyOf(meta) : namespace.replace(/\./g, "_");
    const ownable = meta?.ownable != null;

    const screens = groups.get(group) ?? new Map();
    const screen = screens.get(key) ?? { key, actions: [], sources: [], qualifier: null, scopes: [], ownable: false, allUnavailable: true };
    screen.actions.push({ permission: entry.permission, verb: meta?.verb ?? verb, unavailable: entry.unavailable, grants: entry.grants });
    screen.ownable ||= ownable;
    screen.allUnavailable &&= entry.unavailable;

    for (const grant of entry.grants) {
      const qualifier = ownable ? (grant.qualifier as AccessQualifier) : "all";
      if (!screen.scopes.some((scope: Scope) => placeKey(scope) === placeKey(grant.scope))) screen.scopes.push(grant.scope);
      if (ownable) screen.qualifier = screen.qualifier ? wider(screen.qualifier, qualifier) : qualifier;
      const same = screen.sources.find((source: EffectiveSource) => source.roleName === grant.role_name && placeKey(source.scope) === placeKey(grant.scope));
      if (!same) screen.sources.push({ roleKey: grant.role_key, roleName: grant.role_name, qualifier, scope: grant.scope });
      else if (ownable) screen.sources[screen.sources.indexOf(same)] = { ...same, qualifier: wider(same.qualifier, qualifier) };
    }
    screens.set(key, screen);
    groups.set(group, screens);
  }

  const keys = [...groups.keys()].sort((a, b) => Number(a === SYSTEM_GROUP) - Number(b === SYSTEM_GROUP) || a.localeCompare(b));
  return keys.map((key) => ({
    key,
    screens: [...(groups.get(key)?.values() ?? [])]
      .map((screen) => ({
        ...screen,
        actions: [...screen.actions].sort((a, b) => verbRank(a.verb) - verbRank(b.verb) || a.verb.localeCompare(b.verb)),
        // the root first: what applies everywhere is what a reader looks for
        scopes: [...screen.scopes].sort((a, b) => Number(b.level === rootLevel) - Number(a.level === rootLevel)),
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  }));
}
