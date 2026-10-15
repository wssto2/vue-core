import type { Permission } from "../platform";

// The permissions go-core's incident routes check (`incident.DefinePermissions`): the ids are fixed. Typed as the
// application's catalogue (`PermissionRegistry`) so they fit its routes, whatever it declares.
export const VIEW_INCIDENTS = "incident:view" as Permission;
export const CREATE_INCIDENTS = "incident:create" as Permission;
export const UPDATE_INCIDENTS = "incident:update" as Permission;
/** The staff: they see every incident, write internal comments, fill the advanced fields of a report and get the alerts. */
export const MANAGE_INCIDENTS = "incident:manage" as Permission;
