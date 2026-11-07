import type { Permission } from "../platform";

// The permissions go-core's characteristics routes check. Typed as the application's catalogue (`PermissionRegistry`) so they fit its routes.
export const VIEW_CHARACTERISTICS = "characteristics:view" as Permission;
export const EDIT_CHARACTERISTICS = "characteristics:edit" as Permission;
