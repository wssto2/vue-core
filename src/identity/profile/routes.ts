import type { RouteRecordRaw } from "vue-router";
import { defineRoutes } from "../../router";

/**
 * The route of "my profile": any signed-in person may open it (no permission), which is why it has no `access`. The name and
 * path are fixed, so a link of the application can name them.
 */
export interface ProfileRoutes {
  /** The records `usersFeature` installs. */
  readonly records: readonly RouteRecordRaw[];
  readonly index: { readonly name: "profile" };
}

// Typed by hand: the inferred type would name the screen's module in the published declarations.
export const profileRoutes: ProfileRoutes = defineRoutes({
  index: { name: "profile", path: "/profile", component: () => import("./ProfilePage.vue"), meta: { titleKey: "core.profile.title" } },
});
