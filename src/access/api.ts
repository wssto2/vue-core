import type { HttpClient } from "../client";
import { route } from "../client";
import { accessRoutes } from "../modules/access/routes";
import type { BindInput, BindableInput, CreateRoleInput, SubjectInput, UnbindInput, UpdateRoleInput } from "../modules/access/schemas";
import type { BindableRoles, Binding, ScopeOptions, SubjectAccess, SubjectRef } from "../modules/access/entities";
import type { AccessSubjects } from "./context";
import { usePlatform } from "../platform";
import { useAccessContext } from "./context";

type Options = { readonly signal?: AbortSignal };

/** The routes of one subject kind: go-core's for a user, the application's (`accessFeature({ subjects })`) for any other. */
function routesOf(subjects: AccessSubjects, kind: SubjectRef["kind"]) {
  if (kind === "user") return accessRoutes;
  const where = subjects[kind];
  if (!where) throw new Error(`vue-core access: no routes for ${kind} subjects; pass accessFeature({ subjects: { ${kind}: { base, bindable } } })`);
  return {
    bindable: route<BindableInput, BindableRoles>("GET", where.bindable),
    subjectsAccess: route<SubjectInput, SubjectAccess>("GET", `${where.base}/:id/access`),
    subjectsScopes: route<SubjectInput, ScopeOptions>("GET", `${where.base}/:id/scopes`),
    subjectsBind: route<BindInput, Binding>("POST", `${where.base}/:id/bindings`),
    subjectsUnbind: route<UnbindInput, void>("DELETE", `${where.base}/:id/bindings/:binding_id`),
  };
}

/** go-core's access routes as calls; `data` of each answer already read. A subject of another kind than `user` goes to `subjects[kind]`. */
export function createAccessApi(http: HttpClient, subjects: AccessSubjects = {}) {
  return {
    roles: async (options?: Options) => (await http.request(accessRoutes.rolesList, undefined, options)).data.roles,
    role: async (ref: string, options?: Options) => (await http.request(accessRoutes.rolesShow, { ref }, options)).data,
    holders: async (ref: string, options?: Options) => (await http.request(accessRoutes.rolesHolders, { ref }, options)).data.holders,
    compare: async (ref: string, other: string, options?: Options) => (await http.request(accessRoutes.rolesCompare, { ref, with: other }, options)).data,
    create: async (input: CreateRoleInput) => (await http.request(accessRoutes.rolesCreate, input)).data,
    update: async (input: UpdateRoleInput) => (await http.request(accessRoutes.rolesUpdate, input)).data,
    remove: async (ref: string) => void (await http.request(accessRoutes.rolesDelete, { ref })),
    replace: async (ref: string, other: string) => (await http.request(accessRoutes.rolesReplace, { ref, with: other })).data.rebound,
    access: async (subject: SubjectRef, options?: Options) => (await http.request(routesOf(subjects, subject.kind).subjectsAccess, { id: subject.id }, options)).data,
    scopes: async (subject: SubjectRef, options?: Options) => (await http.request(routesOf(subjects, subject.kind).subjectsScopes, { id: subject.id }, options)).data,
    bindable: async (subject: SubjectRef, level: string, scopeId: number | null, options?: Options) =>
      (await http.request(routesOf(subjects, subject.kind).bindable, { level, scope_id: scopeId ?? 0 }, options)).data.roles,
    bind: async (subject: SubjectRef, input: Omit<BindInput, "id">) => (await http.request(routesOf(subjects, subject.kind).subjectsBind, { id: subject.id, ...input })).data,
    unbind: async (subject: SubjectRef, bindingId: number) => void (await http.request(routesOf(subjects, subject.kind).subjectsUnbind, { id: subject.id, binding_id: bindingId })),
  };
}

export type AccessApi = ReturnType<typeof createAccessApi>;

/** The calls, over the platform's client; call it in `setup`. */
export const useAccessApi = (): AccessApi => createAccessApi(usePlatform().http, useAccessContext().subjects);
