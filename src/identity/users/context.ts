import { defineFeatureContext, type Permission } from "../../platform";

/** What the screens of `usersFeature` need from the feature that installed them. */
export interface UsersContext {
  /** The permission that shows "Sign in as" on a person's record; false leaves it out. */
  readonly signInAs: Permission | false;
}

export const [usersContextKey, useUsersContext] = defineFeatureContext<UsersContext>("vue-core.users");
