import type { BootstrapConfig } from "./bootstrap";
import type { SessionUser } from "./session";
export { createAccessClient } from "./access";
export type { AccessClient, AccessClientOptions, AccessClause, AccessQualifier, AccessScope, AccessSnapshot, HeldAccess } from "./access";
export { BootstrapError, BootstrapFields, parseBootstrap, readBootstrap } from "./bootstrap";
export type { BootstrapConfig, ReadBootstrapOptions } from "./bootstrap";
export { defineFeatureContext, MissingContextError } from "./context";
export { parseNavigation } from "./navigation";
export type { NavigationNode } from "./navigation";
export { httpSessionAdapter, parseSessionPayload } from "./httpSession";
export type { HttpSessionOptions, UserParser } from "./httpSession";
export { createPlatform, installPlatform, platformKey, usePlatform } from "./platform";
export type { Platform, PlatformOptions } from "./platform";
export { useSessionUser } from "./sessionUser";
export { beforeSignOutTimeout, createSession, heldSession } from "./session";
export type { BeforeSignOutHook, Session, SessionAdapter, SessionEnd, SessionImpersonator, SessionOptions, SessionSnapshot, SessionState, SessionUser } from "./session";

/**
 * The permission identifiers of the application. The library declares none: an app adds its own by
 * augmenting this interface (declaration merging, like `IconRegistry`), so route metadata and
 * `defineRoutes` reject a permission the catalogue does not have.
 *
 *   declare module "@wssto2/vue-core/platform" {
 *     interface PermissionRegistry { "tickets:view": true; "tickets:update": true }
 *   }
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- an empty interface is the point: apps augment it
export interface PermissionRegistry {}

/** Every permission identifier the application declared; any string until it declares some. */
export type Permission = keyof PermissionRegistry extends never ? string : Extract<keyof PermissionRegistry, string>;
export { default as AccessGate } from "./AccessGate.vue";
export type { AccessGateProps } from "./AccessGate.vue";

/**
 * The application's own session user and bootstrap config. The library declares neither: an app says
 * once what they are by augmenting this interface (declaration merging, like `PermissionRegistry`), and
 * `usePlatform()`, `useSessionUser()`, `createApplication` and `createTestPlatform` are typed from it, with no cast.
 *
 *   declare module "@wssto2/vue-core/platform" {
 *     interface PlatformRegistry { user: AppUser; config: AppConfig }
 *   }
 *
 * Both keys are optional: a missing one leaves `SessionUser` / `BootstrapConfig`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- an empty interface is the point: apps augment it
export interface PlatformRegistry {}

/** The registered session user (`PlatformRegistry["user"]`); `SessionUser` until the app declares one. */
export type RegisteredUser = PlatformRegistry extends { user: infer U extends SessionUser } ? U : SessionUser;

/** The registered bootstrap config (`PlatformRegistry["config"]`); `BootstrapConfig` until the app declares one. */
export type RegisteredConfig = PlatformRegistry extends { config: infer C extends BootstrapConfig } ? C : BootstrapConfig;
