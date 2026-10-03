import type { RouteLocationRaw } from "vue-router";
import { defineFeatureContext } from "../platform";
import type { ScopeOptions, SubjectRef } from "../modules/access/entities";
import type { PermissionCatalogue } from "./catalogue";

/** What the access screens need from the feature that installed them. */
export interface AccessContext {
  readonly catalogue: PermissionCatalogue;
  /** The hierarchy's top level, where a role is bound for the whole application. */
  readonly rootLevel: string;
  /** Where a holder's name leads (their record), or null for a name that is not a link. */
  readonly subjectRoute: (subject: SubjectRef) => RouteLocationRaw | null;
  /** The places `subject` may be given roles at; by default what the server says (`GET /v1/iam/users/:id/scopes`). */
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
