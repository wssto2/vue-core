import type { RouteRecordRaw } from "vue-router";
import { defineRoutes } from "../../router";
import { VIEW_DEAD_LETTERS } from "./access";

/**
 * The route of the dead-letters page (`/events/dead-letters`, name `events.deadletters`), for whoever holds
 * `events.deadletter:view`: a typed target for links and the record `notificationsFeature` installs.
 */
export interface DeadLettersRoutes {
  /** The records `notificationsFeature` installs. */
  readonly records: readonly RouteRecordRaw[];
  readonly index: { readonly name: "events.deadletters" };
}

// Typed by hand: the inferred type would name the screen's module in the published declarations.
export const deadLettersRoutes: DeadLettersRoutes = defineRoutes({
  index: { name: "events.deadletters", path: "/events/dead-letters", component: () => import("./DeadLetters.vue"), meta: { access: VIEW_DEAD_LETTERS, titleKey: "core.notifications.dead_letters.title" } },
});
