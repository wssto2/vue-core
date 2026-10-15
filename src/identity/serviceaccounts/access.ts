import type { Permission } from "../../platform";

// The permissions go-core's service account routes check (`identity/serviceaccount`). Typed as the application's
// catalogue (`PermissionRegistry`) so they fit its routes, whatever it declares.
export const VIEW_ACCOUNTS = "iam.serviceaccount:view" as Permission;
export const MANAGE_ACCOUNTS = "iam.serviceaccount:manage" as Permission;
export const REVOKE_KEYS = "iam.serviceaccount:revoke" as Permission;
