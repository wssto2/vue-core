import type { Permission } from "../../platform";

// The permissions go-core's dead-letter routes check (`notification.DefinePermissions`): the ids are fixed. Typed as the
// application's catalogue (`PermissionRegistry`) so they fit its routes, whatever it declares.
export const VIEW_DEAD_LETTERS = "events.deadletter:view" as Permission;
export const RETRY_DEAD_LETTERS = "events.deadletter:retry" as Permission;
