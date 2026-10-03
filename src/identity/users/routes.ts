import { defineRoutes } from "../../router";
import { VIEW_USERS } from "./access";

/**
 * The routes of `usersFeature`: typed targets for links (`usersRoutes.index`), and the records the feature installs.
 * The names and paths are fixed, so a link or a menu binding of the application can name them.
 */
export const usersRoutes = defineRoutes({
  index: { name: "users.index", path: "/users", component: () => import("./UsersList.vue"), meta: { access: VIEW_USERS, titleKey: "core.users.title" } },
});
