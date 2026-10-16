import type { ProfileSection } from "../profile/profileSections";
import { defineFeatureContext, type Permission } from "../../platform";
import type { UsersReplace } from "./replace";
import type { ActivityRecord, ChangeWordsFn } from "./words";

/** What the screens of `usersFeature` need from the feature that installed them. */
export interface UsersContext {
  /** The permission that shows "Sign in as" on a person's record; false leaves it out. */
  readonly signInAs: Permission | false;
  /** The application's areas for the Activity section: an area key of the server's audit, and the i18n key that names it. */
  readonly activityAreas: Readonly<Record<string, string>>;
  /** The panels the application adds to "My profile". */
  readonly profileSections: readonly ProfileSection[];
  /** The screens the application swapped for its own (`useUserDialogs()` resolves the dialogs). */
  readonly replace: UsersReplace;
  /** The records the Activity section names and links, by the server's `record_type`. */
  readonly activityRecords: Readonly<Record<string, ActivityRecord>>;
  /** The application's wording of a change; without it the library's. */
  readonly changeWords: ChangeWordsFn | undefined;
}

export const [usersContextKey, useUsersContext] = defineFeatureContext<UsersContext>("vue-core.users");
