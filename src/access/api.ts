import type { HttpClient } from "../client";
import { accessRoutes } from "../modules/access/routes";
import type { BindInput, CreateRoleInput, UpdateRoleInput } from "../modules/access/schemas";
import type { SubjectRef } from "../modules/access/entities";
import { usePlatform } from "../platform";

type Options = { readonly signal?: AbortSignal };

/** go-core's access routes as calls; `data` of each answer already read. */
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
    access: async (subject: SubjectRef, options?: Options) => (await http.request(accessRoutes.subjectsAccess, { id: subject.id }, options)).data,
    scopes: async (subject: SubjectRef, options?: Options) => (await http.request(accessRoutes.subjectsScopes, { id: subject.id }, options)).data,
    bindable: async (level: string, scopeId: number | null, options?: Options) =>
      (await http.request(accessRoutes.bindable, { level, scope_id: scopeId ?? 0 }, options)).data.roles,
    bind: async (subject: SubjectRef, input: Omit<BindInput, "id">) => (await http.request(accessRoutes.subjectsBind, { id: subject.id, ...input })).data,
    unbind: async (subject: SubjectRef, bindingId: number) => void (await http.request(accessRoutes.subjectsUnbind, { id: subject.id, binding_id: bindingId })),
  };
}

export type AccessApi = ReturnType<typeof createAccessApi>;

/** The calls, over the platform's client; call it in `setup`. */
export const useAccessApi = (): AccessApi => createAccessApi(usePlatform().http);
