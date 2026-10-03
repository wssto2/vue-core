// go-core's access module (roles, bindings, effective access): the types and the route table of its HTTP
// contract (src/modules/access, committed from go-core by `npm run modules:sync`), and the screens built on them.
export type * from "../modules/access/entities";
export type * as Inputs from "../modules/access/schemas";
export { accessRoutes } from "../modules/access/routes";
export { accessFeature } from "./feature";
export type { AccessFeatureOptions } from "./feature";
export { accessPages, personRolesSection } from "./routes";
export { accessPermissions } from "./context";
export { dependantsClosure, permissionTree, requiredClosure } from "./catalogue";
export type { Grants, PermissionCatalogue, PermissionEntry, PermissionGroup, PermissionMeta, PermissionScreen } from "./catalogue";
export { useAccessLabels } from "./labels";
export { useRefusalMessage } from "./refusals";
export { default as PersonAccess } from "./PersonAccess.vue";
export { default as BindingRow } from "./BindingRow.vue";
