import { defineFeature, provideContext, type Feature, type SessionEffect } from "../app";
import { notificationRoutes } from "../modules/notification/routes";
import { shallowRef, type ShallowRef } from "vue";
import { notificationsContextKey, type NotificationCategoryLook } from "./context";
import { createInbox, type Inbox } from "./inbox";
import NotificationBell from "./NotificationBell.vue";

export interface NotificationsFeatureOptions {
  /** How each category the application declared in go-core is drawn: the icon of its rows and the colour behind it. A category without an entry gets the bell on a neutral tile. */
  categories?: Readonly<Record<string, NotificationCategoryLook>>;
}

/** The inbox of one session: made when the person signs in, and ended, with its stream, when the session ends or changes (signing in as somebody else included). */
function inboxOfSession(holder: ShallowRef<Inbox | null>): SessionEffect {
  return {
    id: "notifications.inbox",
    scope: "session",
    start({ signal, platform }) {
      const base = platform.config.apiBase.replace(/\/+$/, "");
      holder.value = createInbox({ http: platform.http, streamUrl: `${base}/${notificationRoutes.stream.path.replace(/^\/+/, "")}`, signal });
      return () => {
        holder.value = null;
      };
    },
  };
}

/**
 * The in-app notifications of go-core's notification module, one feature to install: the bell with the
 * unread count in the shell's `headerActions`, the inbox it opens (a popover on wide screens, a bottom sheet on
 * phones), and the live stream behind both, which follows the session. Needs a shell with a `headerActions` place.
 *
 *   createApplication({ platform, shell: backofficeShell(), features: [identityFeature(), notificationsFeature({ categories: { "tickets.assigned": { icon: "user3Line", hue: "blue" } } })] })
 */
export function notificationsFeature(options: NotificationsFeatureOptions = {}): Feature {
  const inbox = shallowRef<Inbox | null>(null);
  return defineFeature({
    id: "notifications",
    context: provideContext(notificationsContextKey, { inbox, categories: options.categories ?? {} }),
    contributions: [{ id: "notifications.bell", slot: "headerActions", component: NotificationBell, scope: "authenticated" }],
    effects: [inboxOfSession(inbox)],
  });
}
