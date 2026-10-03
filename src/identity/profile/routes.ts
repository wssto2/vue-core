import { defineRoutes } from "../../router";

/**
 * The route of "my profile": any signed-in person may open it (no permission), which is why it has no `access`. The name and
 * path are fixed, so a link of the application can name them.
 */
export const profileRoutes = defineRoutes({
  index: { name: "profile", path: "/profile", component: () => import("./ProfilePage.vue"), meta: { titleKey: "core.profile.title" } },
});
