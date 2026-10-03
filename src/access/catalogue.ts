import type { AccessQualifier } from "../platform";

/**
 * What go-core's catalogue says about one permission: the shape of `authzts`'s `PermissionMeta`, so the
 * `permissions` object its generator writes (`frontend/generated/permissions.ts`) is the catalogue as it is.
 */
export interface PermissionMeta {
  readonly module: string;
  /** Empty for a permission of the module itself. */
  readonly resource: string;
  readonly verb: string;
  /** i18n keys; the texts live in the application. */
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly sensitive: boolean;
  readonly system: boolean;
  readonly organizationOnly: boolean;
  /** The record type the "whose" qualifiers refer to; null when the permission has no owner. */
  readonly ownable: string | null;
  readonly unownedIsOwn: boolean;
  readonly feature: string | null;
  readonly attributes: readonly string[];
  readonly requires: readonly string[];
}

/** Every permission of the application by identifier (`module.resource:verb`). */
export type PermissionCatalogue = Readonly<Record<string, PermissionMeta>>;

/** A permission with its identifier. */
export interface PermissionEntry extends PermissionMeta {
  readonly id: string;
}

/** The permissions of one screen (a resource of a module). */
export interface PermissionScreen {
  /** `module` or `module_resource` (dots turned into underscores): the i18n key of its heading, under `access.resources`. */
  readonly key: string;
  readonly permissions: readonly PermissionEntry[];
}

/** One tab of the editor: a module's screens. Permissions that run the system are together in the group `system`. */
export interface PermissionGroup {
  readonly key: string;
  readonly screens: readonly PermissionScreen[];
}

export const SYSTEM_GROUP = "system";

const VERB_ORDER = ["view", "create", "update", "manage", "delete"];
const verbRank = (verb: string): number => {
  const rank = VERB_ORDER.indexOf(verb);
  return rank === -1 ? VERB_ORDER.length : rank;
};

export const groupOf = (meta: Pick<PermissionMeta, "module" | "system">): string => (meta.system ? SYSTEM_GROUP : meta.module);

export const screenKeyOf = (meta: Pick<PermissionMeta, "module" | "resource">): string =>
  meta.resource === "" ? meta.module : `${meta.module}_${meta.resource.replace(/\./g, "_")}`;

/** The catalogue as the editor shows it: module, then screen, then action (view, create, update, manage, delete, the rest by name). */
export function permissionTree(catalogue: PermissionCatalogue): readonly PermissionGroup[] {
  const groups = new Map<string, Map<string, PermissionEntry[]>>();
  for (const [id, meta] of Object.entries(catalogue)) {
    const screens = groups.get(groupOf(meta)) ?? new Map<string, PermissionEntry[]>();
    const key = screenKeyOf(meta);
    screens.set(key, [...(screens.get(key) ?? []), { ...meta, id }]);
    groups.set(groupOf(meta), screens);
  }
  const keys = [...groups.keys()].sort((a, b) => Number(a === SYSTEM_GROUP) - Number(b === SYSTEM_GROUP) || a.localeCompare(b));
  return keys.map((key) => ({
    key,
    screens: [...(groups.get(key) ?? [])]
      .map(([screen, permissions]) => ({ key: screen, permissions: permissions.sort((a, b) => verbRank(a.verb) - verbRank(b.verb) || a.verb.localeCompare(b.verb)) }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  }));
}

/** Everything `id` needs, transitively (not `id` itself). */
export function requiredClosure(catalogue: PermissionCatalogue, id: string): string[] {
  const seen = new Set<string>();
  const walk = (current: string) => {
    for (const required of catalogue[current]?.requires ?? []) {
      if (seen.has(required)) continue;
      seen.add(required);
      walk(required);
    }
  };
  walk(id);
  return [...seen];
}

/** Everything that needs `id`, transitively (not `id` itself). */
export function dependantsClosure(catalogue: PermissionCatalogue, id: string): string[] {
  const seen = new Set<string>();
  const walk = (current: string) => {
    for (const [other, meta] of Object.entries(catalogue)) {
      if (seen.has(other) || !meta.requires.includes(current)) continue;
      seen.add(other);
      walk(other);
    }
  };
  walk(id);
  return [...seen];
}

/** What a role holds: each permission with whose records it reaches (`all` for a permission that has no owner). */
export type Grants = Record<string, AccessQualifier>;

/** The whose the role holds of a record type: its view permission's, else any granted one's; null when it holds none. */
export function ownableQualifier(catalogue: PermissionCatalogue, grants: Grants, ownable: string): AccessQualifier | null {
  const held = Object.entries(catalogue).filter(([id, meta]) => meta.ownable === ownable && id in grants);
  const chosen = held.find(([, meta]) => meta.verb === "view") ?? held[0];
  return chosen ? (grants[chosen[0]] ?? null) : null;
}

/** Grants `id` and what it needs; the whose of an ownable one is what the role already holds of its record type, else `own`. */
export function grant(catalogue: PermissionCatalogue, grants: Grants, id: string): void {
  for (const permission of [id, ...requiredClosure(catalogue, id)]) {
    if (permission in grants || !(permission in catalogue)) continue;
    const ownable = catalogue[permission]?.ownable;
    grants[permission] = ownable ? (ownableQualifier(catalogue, grants, ownable) ?? "own") : "all";
  }
}

/** Takes `id` away, and what needs it. */
export function revoke(catalogue: PermissionCatalogue, grants: Grants, id: string): void {
  for (const permission of [id, ...dependantsClosure(catalogue, id)]) delete grants[permission];
}

/** Applies one whose to every granted permission of the record type. */
export function setOwnableQualifier(catalogue: PermissionCatalogue, grants: Grants, ownable: string, qualifier: AccessQualifier): void {
  for (const [id, meta] of Object.entries(catalogue)) if (meta.ownable === ownable && id in grants) grants[id] = qualifier;
}

/**
 * Grants what the granted permissions need but the role lacks (a role saved before a permission gained a
 * requirement, which the server would refuse as it is). Returns what was added.
 */
export function completeRequired(catalogue: PermissionCatalogue, grants: Grants): string[] {
  const before = new Set(Object.keys(grants));
  for (const id of before) grant(catalogue, grants, id);
  return Object.keys(grants).filter((id) => !before.has(id));
}
