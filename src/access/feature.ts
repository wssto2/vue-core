import type { RouteLocationRaw } from "vue-router";
import { defineFeature, provideContext, type Feature } from "../app";
import type { ScopeOptions, SubjectRef } from "../modules/access/entities";
import type { Destination } from "../router";
import type { PermissionCatalogue } from "./catalogue";
import { accessContextKey } from "./context";
import { accessPages } from "./routes";

export interface AccessFeatureOptions {
  /**
   * The application's permissions: the `permissions` object go-core's `authzts` writes (`frontend/generated/permissions.ts`).
   * The role editor's tree is this catalogue; the texts are the application's (`labelKey`, `access.modules.<module>`, ...).
   */
  catalogue: PermissionCatalogue;
  /** The hierarchy's top level, where a role is bound for the whole application. Default `organization`, go-core's own. */
  rootLevel?: string;
  /** Where a holder's name leads (their record). Default: nowhere, the name is not a link. */
  subjectRoute?: (subject: SubjectRef) => RouteLocationRaw | null;
  /** The places a person may be given roles at. Default: what the server says (`GET /v1/iam/users/:id/scopes`). */
  scopes?: (subject: SubjectRef, signal: AbortSignal) => Promise<ScopeOptions>;
  /** The backend's navigation destination that opens the roles list. Without it the application links to `accessPages.roles` itself. */
  destination?: Destination;
}

/**
 * The screens of go-core's access module, one feature to install: the roles list (`/iam/roles`), a role's page and the editor of
 * a new role (`/iam/roles/new`, `?copy=` to start from another role), compare and replace, with every action behind the module's
 * own permissions (`iam.role:view`, `manage`, `delete`). Pair it with `identityFeature()`; the module's routes must be mounted
 * on the server (`access.Install`).
 *
 *   createApplication({ platform, shell: backofficeShell(), features: [identityFeature(), accessFeature({ catalogue: permissions })] })
 */
export function accessFeature(options: AccessFeatureOptions): Feature {
  return defineFeature({
    id: "access",
    routes: accessPages.records,
    context: provideContext(accessContextKey, {
      catalogue: options.catalogue,
      rootLevel: options.rootLevel ?? "organization",
      subjectRoute: options.subjectRoute ?? (() => null),
      scopes: options.scopes ?? null,
    }),
    navigation: options.destination ? [{ destination: options.destination, to: accessPages.roles, within: ["access.role", "access.roles.new"] }] : [],
  });
}
