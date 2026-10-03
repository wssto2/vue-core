import { defineFeature, provideContext, type Feature } from "../../app";
import type { Permission } from "../../platform";
import type { Destination } from "../../router";
import ProfileMenuItem from "../profile/ProfileMenuItem.vue";
import { profileRoutes } from "../profile/routes";
import { usersContextKey } from "./context";
import { personSectionRoute, type PersonSection } from "./personSections";
import { usersRoutes } from "./routes";

/** The users routes, the record carrying the application's own sections after its own. */
function withSections(sections: readonly PersonSection[]) {
  return usersRoutes.records.map((record) => (record.name === "users.record" ? { ...record, children: [...(record.children ?? []), ...sections.map(personSectionRoute)] } : record));
}

export interface UsersFeatureOptions {
  /** The users list and a person's record (`/users`), for whoever holds `iam.user:view`. Default true. */
  people?: boolean;
  /** "My profile" (`/profile`) and its entry in the account menu, for every signed-in person. Default true. */
  profile?: boolean;
  /** The permission that shows "Sign in as" on a person's record (what the server's `AllowImpersonation` was given). Default `iam.user:impersonate`; `false` leaves the button out. */
  signInAs?: Permission | false;
  /** Sections the application adds to a person's record after the feature's own (their roles); each is a child route `users.record.<path>`. */
  sections?: readonly PersonSection[];
  /** The destination of the backend's menu that opens the users list. Without it the application binds the list itself. */
  destination?: Destination;
}

/**
 * The screens of go-core's users and profile routes, one feature to install:
 *
 * - **People** (`people`): the users list (`/users`, route `users.index`) and a person's record (`users.record`, with its
 *   sections: details, sign-in, sessions, sign-in history, changes), for whoever administers people. Every screen and action
 *   is behind the permission go-core checks for it (`iam.user:view`, `iam.user:manage`), so an application installs it for
 *   everyone and the server's catalogue decides who sees what.
 * - **My profile** (`profile`): the signed-in person's own name and phone, password, e-mail address (changed with a code),
 *   sessions and sign-ins (`/profile`, route `profile`), with an entry in the account menu.
 *
 * An application leaves out what it does not want (`people: false`) and links to the rest by route name (`usersRoutes`,
 * `profileRoutes`). It needs `identityFeature()` next to it for "Sign in as".
 *
 *   createApplication({ platform, shell: backofficeShell(), features: [identityFeature(), usersFeature({ destination: "users" })] })
 */
export function usersFeature(options: UsersFeatureOptions = {}): Feature {
  const people = options.people ?? true;
  const profile = options.profile ?? true;
  const signInAs = options.signInAs ?? ("iam.user:impersonate" as Permission);
  return defineFeature({
    id: "users",
    routes: [...(people ? withSections(options.sections ?? []) : []), ...(profile ? profileRoutes.records : [])],
    context: provideContext(usersContextKey, { signInAs }),
    navigation: people && options.destination ? [{ destination: options.destination, to: usersRoutes.index, within: ["users.record"] }] : [],
    // The entry of the account menu; a shell without that menu leaves it out.
    contributions: profile ? [{ id: "users.profile", slot: "accountMenu", component: ProfileMenuItem, scope: "authenticated", optional: true, order: -10 }] : [],
    requires: people && signInAs !== false ? ["identity"] : [],
  });
}
