import type { Page, Route } from "@playwright/test";
import type { Binding, Constraint, Grant, PersonRef, Role, RoleHolder, RoleSummary, Scope, ScopeOptions } from "../modules/access/entities";
import { json, noContent, ok, refusal } from "./envelope";
import { readRequest, type Call } from "./request";

/**
 * go-core's access wire as it serves it under `/api/v1/iam` (the access module): the roles with their holders, compare and replace, the
 * roles bindable at a place, and a person's (or a service account's) access, scopes and bindings. A fake with a little state, so a
 * spec reads what it did through `calls` and the next read shows the change. It knows no role of yours: pass the roles, the places
 * and the bindings your application has.
 */

export type { Binding, Constraint, Grant, Role, RoleSummary, Scope };
export type { Call } from "./request";

export const ORGANIZATION: Scope = { level: "organization", id: null, name: null };
/** A place below the organization (`scopeOf("dealer", 1, "Auto Zagreb")`). */
export const scopeOf = (level: string, id: number, name: string): Scope => ({ level, id, name });

/** A role as go-core sends it: a predefined one by its key, a custom one by its id as the ref. */
export const role = (ref: string, over: Partial<Role> = {}): Role => {
  const custom = /^\d+$/.test(ref);
  const grants = over.grants ?? [];

  return {
    ref, id: custom ? Number(ref) : null, key: custom ? null : ref, name: `Role ${ref}`, description: "", predefined: !custom, computed: false,
    attrs: [], holders: 0, permission_count: grants.length, ...over, grants,
  };
};

export const summary = ({ grants: _grants, ...rest }: Role): RoleSummary => rest;
export const bindingOf = (id: number, of: Role, scope: Scope, createdBy: PersonRef | null = null): Binding => ({ id, role: summary(of), scope, created_by: createdBy, created_at: "2026-01-01T00:00:00Z" });

export type Hook = (route: Route, url: URL, method: string, body: unknown) => Promise<boolean | void> | boolean | void;

export type AccessOptions = {
  roles?: Role[];
  holders?: Record<string, RoleHolder[]>;
  /** The roles the actor may give at a place (default: every predefined role). */
  bindable?: Role[];
  /** The bindings of each subject, by `user:3` / `service:21`. */
  bindings?: Record<string, Binding[]>;
  /** The places a role can be given at (default only the organization). */
  places?: ScopeOptions;
  canManage?: boolean;
  /** The id of the next role and binding the page creates (default one past the highest there is). */
  next?: { role?: number; binding?: number };
  /** Answers first; true means it answered. */
  hook?: Hook;
};

export type AccessWire = { calls: Call[]; roles: Role[]; bindings: Record<string, Binding[]>; reads: string[] };

/** A role the server refuses as invalid: `authz.invalid` with its problems as objects. */
export const invalid = (problems: { code: string; permission?: string; detail?: string }[]) => refusal(400, "authz.invalid", { params: { problems } });

const compareOf = (role: Role, other: Role) => {
  const held = new Map(role.grants.map((grant) => [grant.permission, grant.qualifier]));
  const theirs = new Map(other.grants.map((grant) => [grant.permission, grant.qualifier]));

  return {
    only_in_role: role.grants.filter((grant) => !theirs.has(grant.permission)),
    only_in_other: other.grants.filter((grant) => !held.has(grant.permission)),
    different: role.grants.filter((grant) => theirs.has(grant.permission) && theirs.get(grant.permission) !== grant.qualifier)
      .map((grant) => ({ permission: grant.permission, role: grant.qualifier, other: theirs.get(grant.permission)! })),
  };
};

/** One entry per permission, with a grant for each binding that gives it (as go-core's effective access does). */
const effectiveOf = (bindings: Binding[], all: Role[]) => {
  const byPermission = new Map<string, { permission: string; unavailable: boolean; grants: unknown[] }>();

  for (const binding of bindings) {
    for (const grant of all.find((candidate) => candidate.ref === binding.role.ref)?.grants ?? []) {
      const entry = byPermission.get(grant.permission) ?? { permission: grant.permission, unavailable: false, grants: [] };
      entry.grants.push({ qualifier: grant.qualifier, scope: binding.scope, attrs: binding.role.attrs, binding_id: binding.id, role_key: binding.role.key ?? "", role_name: binding.role.name });
      byPermission.set(grant.permission, entry);
    }
  }

  return [...byPermission.values()];
};

const next = (ids: number[]) => Math.max(0, ...ids) + 1;

/** Answers go-core's access routes under `/api/v1/iam`. The page needs `mockAuth` too; register this after it. */
export async function serveAccess(page: Page, options: AccessOptions = {}): Promise<AccessWire> {
  const wire: AccessWire = {
    calls: [],
    roles: structuredClone(options.roles ?? []),
    bindings: structuredClone(options.bindings ?? {}),
    reads: [],
  };
  const places: ScopeOptions = options.places ?? { root_level: "organization", root: true, places: [] };
  let nextRole = options.next?.role ?? next(wire.roles.flatMap((candidate) => (candidate.id === null ? [] : [candidate.id])));
  let nextBinding = options.next?.binding ?? next(Object.values(wire.bindings).flat().map((binding) => binding.id));
  const find = (ref: string) => wire.roles.find((candidate) => candidate.ref === ref);

  await page.route(/\/api\/v1\/iam\/(roles|bindable-roles|service-accounts\/bindable-roles|users\/\d+\/(access|scopes|bindings)|service-accounts\/\d+\/(access|scopes|bindings))/, async (route) => {
    const { method, url, path, body } = readRequest(route);

    if (method !== "GET") wire.calls.push({ method, path, body });
    else wire.reads.push(`${path}${url.search}`);
    if (await options.hook?.(route, url, method, body)) return;

    if (path === "/iam/bindable-roles" || path === "/iam/service-accounts/bindable-roles") return route.fulfill(json(ok({ roles: options.bindable ?? wire.roles.filter((candidate) => candidate.predefined) })));

    const roles = /^\/iam\/roles(?:\/([^/]+)(?:\/(holders|compare|replace))?)?$/.exec(path);
    if (roles) {
      const [, ref, action] = roles;
      if (!ref) {
        if (method === "GET") return route.fulfill(json(ok({ roles: wire.roles.map(summary) })));
        const input = body as { name: string; description: string; grants: Grant[]; attrs: Constraint[] };
        const created = role(String(nextRole++), { name: input.name, description: input.description, grants: input.grants, attrs: input.attrs, holders: 0 });
        wire.roles.push(created);
        return route.fulfill(json(ok(created), 201));
      }
      const found = find(ref);
      if (!found) return route.fulfill(json({ success: false, message: "not found", code: "access.role_not_found" }, 404));
      if (action === "holders") return route.fulfill(json(ok({ holders: options.holders?.[ref] ?? [] })));
      if (action === "compare") {
        const other = find(url.searchParams.get("with") ?? "");
        return other ? route.fulfill(json(ok(compareOf(found, other)))) : route.fulfill(json({ success: false, message: "not found" }, 404));
      }
      if (action === "replace") return route.fulfill(json(ok({ rebound: found.holders })));
      if (method === "GET") return route.fulfill(json(ok(found)));
      if (method === "DELETE") { wire.roles = wire.roles.filter((candidate) => candidate.ref !== ref); return route.fulfill(noContent()); }
      const input = body as { name: string; description: string; grants: Grant[]; attrs: Constraint[] };
      Object.assign(found, { name: input.name, description: input.description, grants: input.grants, attrs: input.attrs, permission_count: input.grants.length });
      return route.fulfill(json(ok(found)));
    }

    const subject = /^\/iam\/(users|service-accounts)\/(\d+)\/(access|scopes|bindings)(?:\/(\d+))?$/.exec(path);
    if (subject) {
      const [, group, id, what, bindingId] = subject;
      const key = `${group === "users" ? "user" : "service"}:${id}`;
      const held = (wire.bindings[key] ??= []);
      if (what === "scopes") return route.fulfill(json(ok(places)));
      if (what === "access") {
        return route.fulfill(json(ok({ subject: { kind: group === "users" ? "user" : "service", id: Number(id) }, bindings: held, effective: effectiveOf(held, wire.roles), can_manage: options.canManage ?? true })));
      }
      if (method === "DELETE") { wire.bindings[key] = held.filter((binding) => binding.id !== Number(bindingId)); return route.fulfill(noContent()); }
      const input = body as { role_ref: string; level: string; scope_id?: number };
      const place: Scope = input.level === "organization" ? ORGANIZATION : { level: input.level, id: input.scope_id ?? null, name: places.places.find((candidate) => candidate.id === input.scope_id && candidate.level === input.level)?.name ?? null };
      const added = bindingOf(nextBinding++, find(input.role_ref) ?? role(input.role_ref), place);
      held.push(added);
      return route.fulfill(json(ok(added), 201));
    }

    return route.fallback();
  });

  return wire;
}
