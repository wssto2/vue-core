// Playwright mocks of this library's own endpoints: go-core's envelope, `/auth/me`, the access, notification, profile and users
// routes. Each registers only its own paths, so an application composes them with the rest of its API; types only from
// `@playwright/test` (an optional peer), nothing of Playwright runs here. Import it from end-to-end specs only.
export { datatable, json, noContent, ok, pageOk, refusal, sse } from "./envelope";
export type { Answer } from "./envelope";
export { accessOf, authBody, authResponse, defaultUser, mockAuth } from "./session";
export type { HeldAt, MockAuthOptions, SessionExtra } from "./session";
export { ORGANIZATION, bindingOf, invalid, role, scopeOf, serveAccess, summary } from "./access";
export type { AccessOptions, AccessWire, Binding, Constraint, Grant, Hook, Role, RoleSummary, Scope } from "./access";
export { device, notification, serveNotifications, setting } from "./notifications";
export type { CategorySettings, Device, Item, QuietHours, Setting, Wire, WireOptions } from "./notifications";
export { NEW_EMAIL, ownSession, ownSignin, pendingChange, profile, serveProfile } from "./profile";
export type { ProfileAnswers, ProfileCall, ProfileOptions } from "./profile";
export { activity, ago, change, freshState, person, serveUsers, serviceAccount, session, signin } from "./users";
export type { UsersOptions, UsersRequest, UsersState, Write } from "./users";
export type { Call } from "./request";
