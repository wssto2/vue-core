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
export { beforeSignOutTimeout, createSession } from "./session";
export type { BeforeSignOutHook, Session, SessionAdapter, SessionEnd, SessionOptions, SessionSnapshot, SessionState, SessionUser } from "./session";

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
