import type { Component } from "vue";
import type { UserDetailWithExt } from "./ext";

/**
 * Whole screens of `usersFeature` an application swaps for its own, with the contract each one keeps. A replacement is
 * mounted where the built-in was, with the same props and events, and finds the same context: `usePlatform()`, the record
 * (`useRouteResourceContext(PERSON)`), the actions (`usePersonActions()`), `useUsersContext()`, the collection (`userList`),
 * and the shared pieces exported beside them.
 */
export interface UsersReplace {
  /** The users list, the page of `users.index`. No props. Open the New user dialog with `useUserDialogs().newUser`. */
  readonly list?: Component;
  /** The "Basic details" section of a person's record (`users.record.general`). No props; reads the person with `useRouteResourceContext(PERSON)`, and its save chrome and rows are its own. */
  readonly general?: Component;
  /** The New user dialog: no props, emits `created` with the new person, exposes `create()` (a `NewUserDialogHandle`). */
  readonly newUser?: Component;
  /** The Deactivate dialog: props `DeactivateDialogProps`, emits `done` after it deactivated, exposes `open()` (a `DeactivateDialogHandle`). */
  readonly deactivate?: Component;
}

/** What the users list and any other screen call on the New user dialog (`replace.newUser`), through a template ref. */
export interface NewUserDialogHandle {
  /** Opens the dialog on an empty form. */
  create(): void;
}
/** The events of the New user dialog. */
export interface NewUserDialogEmits {
  /** The person was created; the list opens their record. */
  created: [user: UserDetailWithExt];
}

/** The props of the Deactivate dialog (`replace.deactivate`). */
export interface DeactivateDialogProps {
  readonly id: number;
  readonly name: string;
  /** How many sessions the person has now; null while they are being counted. */
  readonly sessionCount: number | null;
}
/** What the record page calls on the Deactivate dialog. */
export interface DeactivateDialogHandle {
  /** Opens the dialog. */
  open(): void;
}
/** The events of the Deactivate dialog. */
export interface DeactivateDialogEmits {
  /** The person was deactivated; the record reloads. */
  done: [];
}
