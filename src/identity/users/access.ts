import type { Permission } from "../../platform";

// The permissions go-core's users routes check (`identity/http`): seeing people, and administering them. Typed as the
// application's catalogue (`PermissionRegistry`) so they fit its routes, whatever it declares.
export const VIEW_USERS = "iam.user:view" as Permission;
export const MANAGE_USERS = "iam.user:manage" as Permission;
