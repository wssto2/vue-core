import { defineFeatureContext, type Permission } from "../../platform";

/** What the screens of `usersFeature` need from the feature that installed them. */
export interface UsersContext {
  /** The permission that shows "Sign in as" on a person's record; false leaves it out. */
  readonly signInAs: Permission | false;
  /** The application's areas for the Activity section: an area key of the server's audit, and the i18n key that names it. */
  readonly activityAreas: Readonly<Record<string, string>>;
}

export const [usersContextKey, useUsersContext] = defineFeatureContext<UsersContext>("vue-core.users");
