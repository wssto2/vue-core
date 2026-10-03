import type { RouteRecordRaw } from "vue-router";
import { defineRoutes } from "../../router";

/**
 * The route of the person's own notification settings (`/profile/notifications`, name `notifications.settings`): any signed-in person
 * may open it, so it has no `access`. A typed target for links and the record `notificationsFeature` installs.
 */
export interface NotificationSettingsRoutes {
  /** The records `notificationsFeature` installs. */
  readonly records: readonly RouteRecordRaw[];
  readonly index: { readonly name: "notifications.settings" };
}

// Typed by hand: the inferred type would name the screen's module in the published declarations.
export const notificationSettingsRoutes: NotificationSettingsRoutes = defineRoutes({
  index: { name: "notifications.settings", path: "/profile/notifications", component: () => import("./SettingsPage.vue"), meta: { titleKey: "core.notifications.settings.title" } },
});
