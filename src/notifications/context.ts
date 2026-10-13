import type { Component, ShallowRef } from "vue";
import type { IconName } from "../icon";
import { defineFeatureContext } from "../platform";
import type { Preferences } from "../modules/notification/entities";
import type { Hue } from "../state";
import type { Inbox } from "./inbox";

/** How a category of notification is drawn in the inbox: the icon of its row and the colour behind it. */
export interface NotificationCategoryLook {
  /** Default: the bell. */
  icon?: IconName;
  /** One of the category hues; default neutral. */
  hue?: Hue;
}

/**
 * A panel an application adds to the notification settings page. The component is given the person's `preferences` as a prop.
 * The built-in panels sit at 0 (channels), 10 (quiet hours), 20 (this device) and 30 (devices); a section without an `order` comes
 * after them, in the order given.
 */
export interface NotificationSettingsSection {
  /** Unique among the sections and not one of the built-in ids (`channels`, `quiet`, `device`, `devices`). */
  readonly id: string;
  readonly component: Component;
  readonly order?: number;
  /** Leaves the section out for these preferences. Default: always shown. */
  readonly visible?: (preferences: Preferences) => boolean;
}

/** What the bell and the inbox read from the feature that installed them. */
export interface NotificationsContext {
  /** The signed-in session's inbox; null while nobody is signed in (it is made and ended with the session). */
  readonly inbox: ShallowRef<Inbox | null>;
  readonly categories: Readonly<Record<string, NotificationCategoryLook>>;
  /** Whether the settings page is installed: the inbox shows its gear. */
  readonly settings: boolean;
  /** Whether web push is installed: its panels on the settings page (shown when the server has push) and the sync of this browser's subscription. */
  readonly push: boolean;
  /** The panels the application added to the settings page. */
  readonly sections: readonly NotificationSettingsSection[];
}

export const [notificationsContextKey, useNotificationsContext] = defineFeatureContext<NotificationsContext>("vue-core.notifications");
