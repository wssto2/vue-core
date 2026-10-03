// go-core's access module (roles, bindings, effective access): the types and the route table of its HTTP
// contract (src/modules/access, committed from go-core by `npm run modules:sync`).
export type * from "../modules/access/entities";
export type * as Inputs from "../modules/access/schemas";
export { accessRoutes } from "../modules/access/routes";
