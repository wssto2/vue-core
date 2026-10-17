import type { RouteRecordRaw } from "vue-router";
import { defineFeature, provideContext, type Feature } from "../../app";
import type { Permission } from "../../platform";
import type { Destination } from "../../router";
import type { ProfileSection } from "../profile/profileSections";
import ProfileMenuItem from "../profile/ProfileMenuItem.vue";
import { profileRoutes } from "../profile/routes";
import { usersContextKey } from "./context";
import type { UsersCollection } from "./list";
import { withPersonSections, type PersonSection } from "./personSections";
import type { UsersReplace } from "./replace";
import { usersRoutes } from "./routes";
import type { ActivityRecord, ChangeWordsFn } from "./words";

/**
 * The users routes at the application's path, with the list and the details swapped when it replaced them, and the
 * record carrying the application's own sections after its own.
 */
function peopleRoutes(base: string, replace: UsersReplace, sections: readonly PersonSection[]): RouteRecordRaw[] {
  return usersRoutes.records.map((record) => {
    if (record.name === "users.index") return { ...record, path: base, ...(replace.list && { component: replace.list }) } as RouteRecordRaw;
    if (record.name !== "users.record") return record;
    const children = (record.children ?? []).map((child) => (child.name === "users.record.general" && replace.general ? ({ ...child, component: replace.general } as RouteRecordRaw) : child));
    return { ...record, path: `${base}/:id`, children: withPersonSections(children, sections) } as RouteRecordRaw;
  });
}

export interface UsersFeatureOptions {
  /** The users list and a person's record (`/users`), for whoever holds `iam.user:view`. Default true. */
  people?: boolean;
  /** "My profile" (`/profile`) and its entry in the account menu, for every signed-in person. Default true. */
  profile?: boolean;
  /** The permission that shows "Sign in as" on a person's record (what the server's `AllowImpersonation` was given). Default `iam.user:impersonate`; `false` leaves the button out. */
  signInAs?: Permission | false;
  /** Names of the application's areas in a person's Activity: the area key the audit records (`crm`) and the i18n key of its name. `all`, `identity` and `other` are the library's. An area without a key reads as "Other". */
  activityAreas?: Readonly<Record<string, string>>;
  /** Sections the application adds to a person's record (their roles), at the end or, with `after`, behind a built-in one; each is a child route `users.record.<path>`. */
  sections?: readonly PersonSection[];
  /** Panels the application adds to "My profile" (mobile phone, dealer and location, preferences), each placed after or before a built-in panel. */
  profileSections?: readonly ProfileSection[];
  /** The destination of the backend's menu that opens the users list. Without it the application binds the list itself. */
  destination?: Destination;
  /** The base path of the list; a record is `<path>/:id`. Default `/users`. The route names stay (`users.index`, `users.record`), so links by name follow it. */
  path?: `/${string}`;
  /** Whole screens the application swaps for its own, each keeping the contract documented on `UsersReplace`: the list, the details section, the New user and the Deactivate dialogs. */
  replace?: UsersReplace;
  /**
   * The one definition of the people list, for the list page and for the previous / next of a person's record, so both ask the
   * server the same question. Default `userList` (the library's). An application whose list filters people by more than the
   * library knows (a dealer, a role) passes its own collection: the very definition its `replace.list` page calls `useCollection`
   * on, since the record replays the state that page wrote into the link. A definition, not a factory: the application builds it
   * once, with its own client; the library's default is built from the platform's.
   *
   *   usersFeature({ collection: peopleList, replace: { list: PeopleList } })   // peopleList = defineCollection({ id: "identity.users", …, query: { filters: ["dealer_id", "role"] } })
   */
  collection?: UsersCollection;
  /** What the Activity section calls and links the records the application knows, by the server's `record_type`; an unknown type reads as the type itself. */
  activityRecords?: Readonly<Record<string, ActivityRecord>>;
  /** The application's wording for a change (sentence and details, with links), asked for every row of the Changes section with its `ext`; the library words what it returns nothing for. */
  changeWords?: ChangeWordsFn;
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
  const replace = options.replace ?? {};
  const base = (options.path ?? "/users").replace(/\/+$/, "") || "/users";
  return defineFeature({
    id: "users",
    routes: [...(people ? peopleRoutes(base, replace, options.sections ?? []) : []), ...(profile ? profileRoutes.records : [])],
    context: provideContext(usersContextKey, {
      signInAs,
      activityAreas: options.activityAreas ?? {},
      profileSections: options.profileSections ?? [],
      replace,
      collection: options.collection,
      activityRecords: options.activityRecords ?? {},
      changeWords: options.changeWords,
    }),
    navigation: people && options.destination ? [{ destination: options.destination, to: usersRoutes.index, within: ["users.record"] }] : [],
    // The entry of the account menu; a shell without that menu leaves it out.
    contributions: profile ? [{ id: "users.profile", slot: "accountMenu", component: ProfileMenuItem, scope: "authenticated", optional: true, order: -10 }] : [],
    requires: people && signInAs !== false ? ["identity"] : [],
  });
}
