import type { RouteLocationRaw } from "vue-router";
import { defineFeatureContext } from "../platform";
import type { ScopeOptions, SubjectRef } from "../modules/access/entities";
import type { PermissionCatalogue } from "./catalogue";
import type { RoleConstraint } from "./constraints";

/** Where an application serves the access routes of a subject kind other than `user`: `${base}/:id/{access,scopes,bindings,bindings/:binding_id}`, and the roles it may be given. */
export interface SubjectRoutes {
  readonly base: string;
  readonly bindable: string;
}
export type AccessSubjects = Readonly<Partial<Record<Exclude<SubjectRef["kind"], "user">, SubjectRoutes>>>;

/** What the access screens need from the feature that installed them. */
export interface AccessContext {
  readonly catalogue: PermissionCatalogue;
  /** Where a holder's name leads (their record), or null for a name that is not a link. */
  readonly subjectRoute: (subject: SubjectRef) => RouteLocationRaw | null;
  /** The places `subject` may be given roles at; by default what the server says (`GET /v1/iam/users/:id/scopes`). */
  /** The application's constraints on a role, edited next to its name and kept in its `attrs`. */
  readonly constraints: readonly RoleConstraint[];
  /** The i18n key of the sentence for each of the application's own role-problem codes (`authz.invalid`). */
  readonly problems: Readonly<Record<string, string>>;
  readonly subjects: AccessSubjects;
  readonly scopes: ((subject: SubjectRef, signal: AbortSignal) => Promise<ScopeOptions>) | null;
}

export const [accessContextKey, useAccessContext] = defineFeatureContext<AccessContext>("vue-core.access");

/** The permissions go-core's access module guards its routes with: fixed, so a screen can name them. */
export const accessPermissions = {
  viewRoles: "iam.role:view",
  manageRoles: "iam.role:manage",
  deleteRoles: "iam.role:delete",
  viewAccess: "iam.user:view",
  manageBindings: "iam.user:manage",
} as const;
