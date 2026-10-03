import type { ShallowRef } from "vue";
import type { IconName } from "../icon";
import { defineFeatureContext } from "../platform";
import type { Hue } from "../state";
import type { Inbox } from "./inbox";

/** How a category of notification is drawn in the inbox: the icon of its row and the colour behind it. */
export interface NotificationCategoryLook {
  /** Default: the bell. */
  icon?: IconName;
  /** One of the category hues; default neutral. */
  hue?: Hue;
}

/** What the bell and the inbox read from the feature that installed them. */
export interface NotificationsContext {
  /** The signed-in session's inbox; null while nobody is signed in (it is made and ended with the session). */
  readonly inbox: ShallowRef<Inbox | null>;
  readonly categories: Readonly<Record<string, NotificationCategoryLook>>;
}

export const [notificationsContextKey, useNotificationsContext] = defineFeatureContext<NotificationsContext>("vue-core.notifications");
