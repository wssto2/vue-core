// go-core's identity module: the types and the route table of its HTTP contract (src/modules/identity,
// committed from go-core by `npm run modules:sync`; the input schemas as types only, under `Inputs`), and the
// screens and session wiring built on them.
export type * from "../modules/identity/entities";
export type * as Inputs from "../modules/identity/schemas";
export { identityRoutes } from "../modules/identity/routes";
export { identityFeature } from "./feature";
export type { IdentityFeatureOptions } from "./feature";
export { identityPlatform, identitySessionAdapter } from "./session";
export type { IdentityPlatformOptions } from "./session";
export { embedHeaders, embedSession } from "./embed";
export type { EmbedSession, EmbedSessionOptions, EmbedStorage } from "./embed";
export { usersFeature } from "./users/feature";
export type { UsersFeatureOptions } from "./users/feature";
export type { BuiltInPersonSection, PersonSection } from "./users/personSections";
// What a replaced screen (`usersFeature({ replace })`) is given and reuses: the contract of each, the person it is about,
// the context and the shared pieces of the built-in screens.
export type { UsersReplace, NewUserDialogHandle, NewUserDialogEmits, DeactivateDialogProps, DeactivateDialogHandle, DeactivateDialogEmits } from "./users/replace";
export type { ActivityRecord, ChangeDetail, ChangeWords, ChangeWordsFn, Translate } from "./users/words";
export type { OpenChangeRow } from "./users/ext";
export { PERSON, personActionsKey, usePersonActions, usePersonSessions } from "./users/person";
export type { PersonActions } from "./users/person";
export { useUsersContext } from "./users/context";
export type { UsersContext } from "./users/context";
export { useUserDialogs } from "./users/dialogs";
export { USER_VIEWS, userList } from "./users/list";
export type { UsersCollection } from "./users/list";
export { default as NewUserDialog } from "./users/NewUserDialog.vue";
export { default as DeactivateDialog } from "./users/DeactivateDialog.vue";
export { statusTone } from "./users/status";
export { default as PageBar } from "./shared/PageBar.vue";
export { default as SectionIntro } from "./shared/SectionIntro.vue";
export { default as SessionList } from "./shared/SessionList.vue";
export { default as SignInList } from "./shared/SignInList.vue";
export { default as SignInTable } from "./shared/SignInTable.vue";
export { default as ChangeFeed } from "./shared/ChangeFeed.vue";
export type { ProfilePanel, ProfileSection } from "./profile/profileSections";
export { profileRoutes } from "./profile/routes";
export { usersRoutes } from "./users/routes";
export { default as ActionRow } from "./shared/ActionRow.vue";
export { default as SignInAsButton } from "./SignInAsButton.vue";
export { isSessionEnded, lockedUntil, returnToOwnAccount, signIn, signInAs } from "./signIn";
export { usePreferences } from "./usePreferences";
export type { UsedPreferences } from "./usePreferences";
export { parseIdentityUser } from "./user";
export type { IdentityUser } from "./user";
export { serviceAccountsFeature } from "./serviceaccounts/feature";
export type { ServiceAccountsFeatureOptions } from "./serviceaccounts/feature";
export type { ServiceAccountTenants } from "./serviceaccounts/context";
export { serviceAccountsRoutes } from "./serviceaccounts/routes";
export type { ServiceAccountsRoutes } from "./serviceaccounts/routes";
export type { AccountTenant, ApiKey, ApiKeyList, CreatedApiKey, ServiceAccount, ServiceAccountList } from "../modules/serviceaccount/entities";
export { serviceaccountRoutes } from "../modules/serviceaccount/routes";
