import type { HttpClient } from "../client";
import { accessRoutes } from "../modules/access/routes";
import { serviceaccountRoutes } from "../modules/serviceaccount/routes";
import type { BindInput, CreateRoleInput, UpdateRoleInput } from "../modules/access/schemas";
import type { SubjectRef } from "../modules/access/entities";
import { usePlatform } from "../platform";

type Options = { readonly signal?: AbortSignal };

/** The routes of one subject kind: go-core's access routes for a person, the service accounts' (same handlers, under `/v1/iam/service-accounts`) for a service account. */
function routesOf(kind: SubjectRef["kind"]) {
  if (kind === "user") return accessRoutes;
  const { access, scopes, bind, unbind, bindableroles } = serviceaccountRoutes;
  return { bindable: bindableroles, subjectsAccess: access, subjectsScopes: scopes, subjectsBind: bind, subjectsUnbind: unbind };
}

/** go-core's access routes as calls; `data` of each answer already read. A subject of kind `service` goes to the service accounts' routes. */
export function createAccessApi(http: HttpClient) {
  return {
    roles: async (options?: Options) => (await http.request(accessRoutes.rolesList, undefined, options)).data.roles,
    role: async (ref: string, options?: Options) => (await http.request(accessRoutes.rolesShow, { ref }, options)).data,
    holders: async (ref: string, options?: Options) => (await http.request(accessRoutes.rolesHolders, { ref }, options)).data.holders,
    compare: async (ref: string, other: string, options?: Options) => (await http.request(accessRoutes.rolesCompare, { ref, with: other }, options)).data,
    create: async (input: CreateRoleInput) => (await http.request(accessRoutes.rolesCreate, input)).data,
    update: async (input: UpdateRoleInput) => (await http.request(accessRoutes.rolesUpdate, input)).data,
    remove: async (ref: string) => void (await http.request(accessRoutes.rolesDelete, { ref })),
    replace: async (ref: string, other: string) => (await http.request(accessRoutes.rolesReplace, { ref, with: other })).data.rebound,
    access: async (subject: SubjectRef, options?: Options) => (await http.request(routesOf(subject.kind).subjectsAccess, { id: subject.id }, options)).data,
    scopes: async (subject: SubjectRef, options?: Options) => (await http.request(routesOf(subject.kind).subjectsScopes, { id: subject.id }, options)).data,
    bindable: async (subject: SubjectRef, level: string, scopeId: number | null, options?: Options) =>
      (await http.request(routesOf(subject.kind).bindable, { level, scope_id: scopeId ?? 0 }, options)).data.roles,
    bind: async (subject: SubjectRef, input: Omit<BindInput, "id">) => (await http.request(routesOf(subject.kind).subjectsBind, { id: subject.id, ...input })).data,
    unbind: async (subject: SubjectRef, bindingId: number) => void (await http.request(routesOf(subject.kind).subjectsUnbind, { id: subject.id, binding_id: bindingId })),
  };
}

export type AccessApi = ReturnType<typeof createAccessApi>;

/** The calls, over the platform's client; call it in `setup`. */
export const useAccessApi = (): AccessApi => createAccessApi(usePlatform().http);
