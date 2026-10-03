import { defineRoutes } from "../../router";
import { VIEW_USERS } from "./access";

/**
 * The routes of `usersFeature`: typed targets for links (`usersRoutes.index`, `usersRoutes.record({ id })`), and the
 * records the feature installs. The names and paths are fixed, so a link or a menu binding of the application can name
 * them. The sections of a person's record are its children, reached by name (`users.record.sessions`).
 */
export const usersRoutes = defineRoutes({
  index: { name: "users.index", path: "/users", component: () => import("./UsersList.vue"), meta: { access: VIEW_USERS, titleKey: "core.users.title" } },
  record: {
    name: "users.record",
    path: "/users/:id",
    component: () => import("./UserRecord.vue"),
    meta: { access: VIEW_USERS, titleKey: "core.users.title", remountOnParam: "id" },
    children: [
      { name: "users.record.general", path: "general", component: () => import("./sections/General.vue"), meta: { section: { labelKey: "core.users.sections.general", icon: "user3Line", groupKey: "core.users.section_groups.person" } } },
      { name: "users.record.signin", path: "signin", component: () => import("./sections/SignIn.vue"), meta: { section: { labelKey: "core.users.sections.signin", icon: "key2Line", groupKey: "core.users.section_groups.access" } } },
      { name: "users.record.sessions", path: "sessions", component: () => import("./sections/Sessions.vue"), meta: { section: { labelKey: "core.users.sections.sessions", icon: "deviceLine", groupKey: "core.users.section_groups.access" } } },
      { name: "users.record.signins", path: "signins", component: () => import("./sections/SignIns.vue"), meta: { section: { labelKey: "core.users.sections.signins", icon: "timeFill", groupKey: "core.users.section_groups.activity" } } },
      { name: "users.record.changes", path: "changes", component: () => import("./sections/Changes.vue"), meta: { section: { labelKey: "core.users.sections.changes", icon: "edit", groupKey: "core.users.section_groups.activity" } } },
    ],
  },
});
