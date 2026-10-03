// go-core's identity module: the types and the route table of its HTTP contract (src/modules/identity,
// committed from go-core by `npm run modules:sync`; the input schemas as types only, under `Inputs`), and the
// screens and session wiring built on them.
export type * from "../modules/identity/entities";
export type * as Inputs from "../modules/identity/schemas";
export { identityRoutes } from "../modules/identity/routes";
export { identityFeature } from "./feature";
export type { IdentityFeatureOptions } from "./feature";
export { identityPlatform, identitySessionAdapter, renewIdentityTokens } from "./session";
export type { IdentityPlatformOptions } from "./session";
export { default as SignInAsButton } from "./SignInAsButton.vue";
export { lockedUntil, returnToOwnAccount, signIn, signInAs } from "./signIn";
export { parseIdentityUser } from "./user";
export type { IdentityUser } from "./user";
