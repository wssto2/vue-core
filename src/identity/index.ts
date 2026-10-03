// go-core's identity module: the types and the route table of its HTTP contract (src/modules/identity,
// committed from go-core by `npm run modules:sync`). The input schemas are exported as types only, under `Inputs`.
export type * from "../modules/identity/entities";
export type * as Inputs from "../modules/identity/schemas";
export { identityRoutes } from "../modules/identity/routes";
