import { defineFeature, provideContext, type Feature } from "../../app";
import type { Destination } from "../../router";
import type { Permission } from "../../platform";
import { usersContextKey } from "./context";
import { usersRoutes } from "./routes";

export interface UsersFeatureOptions {
  /** The permission that shows "Sign in as" on a person's record (what the server's `AllowImpersonation` was given). Default `iam.user:impersonate`; `false` leaves the button out. */
  signInAs?: Permission | false;
  /** The destination of the backend's menu that opens the users list. Without it the application binds the list itself. */
  destination?: Destination;
}

/**
 * The screens that administer people, on go-core's identity module: the users list (`/users`, route `users.index`) and a
 * person's record. Every screen and action is behind the permission go-core checks for it (`iam.user:view`,
 * `iam.user:manage`), so an application installs it for everyone and the server's catalogue decides who sees what.
 *
 *   createApplication({ platform, shell: backofficeShell(), features: [identityFeature(), usersFeature({ destination: "users" })] })
 */
export function usersFeature(options: UsersFeatureOptions = {}): Feature {
  const signInAs = options.signInAs ?? "iam.user:impersonate";
  return defineFeature({
    id: "users",
    routes: usersRoutes.records,
    context: provideContext(usersContextKey, { signInAs }),
    navigation: options.destination ? [{ destination: options.destination, to: usersRoutes.index, within: ["users.record"] }] : [],
    requires: signInAs === false ? [] : ["identity"],
  });
}
