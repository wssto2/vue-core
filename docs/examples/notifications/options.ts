// What an application can leave out, link to, or read.
import { deadLettersRoutes, notificationRoutes, notificationsFeature } from "@wssto2/vue-core/notifications";
import type { Notification } from "@wssto2/vue-core/notifications";

// The bell and the inbox only: no dead-letters page.
export const bellOnly = notificationsFeature({ deadLetters: false });

// Links are typed targets: `to` of a RouterLink or `router.push`.
export const toTheFailedEvents = deadLettersRoutes.index;

// The route tables go-core's generator wrote, for calls of your own (a button that sends the signed-in person a test notification).
export const sendTest = notificationRoutes.test;

// What a row of the inbox is.
export const title = (notification: Notification) => notification.title;
