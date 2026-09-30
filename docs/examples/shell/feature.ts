import { defineFeature } from "@wssto2/vue-core/app";
import { localeMessages } from "@wssto2/vue-core/i18n";
import NotificationBell from "./NotificationBell.vue";

// A feature that only contributes to the shell, without the shell's source knowing it. Any shell
// that renders the `headerActions` outlet shows it: the default one and a custom one alike.
export const notificationsFeature = defineFeature({
  id: "notifications",
  messages: localeMessages("notifications", { en: async () => ({ default: { label: "Notifications, {count} unread", none: "No new notifications." } }) }),
  contributions: [
    // `authenticated`: only while someone is signed in. `messages` are loaded before the component renders.
    { id: "notifications.bell", slot: "headerActions", component: NotificationBell, scope: "authenticated", messages: ["notifications"] },
  ],
});
