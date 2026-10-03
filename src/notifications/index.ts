// go-core's notification and events modules: the types and the route tables of their HTTP contracts
// (src/modules/notification and src/modules/events, committed from go-core by `npm run modules:sync`; the
// input schemas as types only, under `Inputs`), and the screens built on them.
export type { Item as Notification, Page as InboxPage, StreamEvent, StreamKind, UnreadCount } from "../modules/notification/entities";
export type * as Inputs from "../modules/notification/schemas";
export { notificationRoutes } from "../modules/notification/routes";
export type { DeadLetterRow, Retried } from "../modules/events/entities";
export type * as DeadLetterInputs from "../modules/events/schemas";
export { eventsRoutes } from "../modules/events/routes";
