// Test helpers for applications built on this library. Nothing here imports a test runner or a
// testing library: they build the application's environment (platform, router, i18n) and fake
// its backend, and you hand them to the tools you already use (vitest, @testing-library/vue,
// @vue/test-utils). Import it from test files only.
export { deferred, settle } from "./async";
export type { Deferred } from "./async";
export { createTestApp, stubRoutes, withSetup } from "./app";
export type { TestApp, TestAppOptions } from "./app";
export { fakeLoader, listPage } from "./collection";
export { testFormatting } from "./format";
export { createTestI18n } from "./i18n";
export type { TestI18nOptions, TestMessages } from "./i18n";
export { mockMedia } from "./media";
export type { MediaState } from "./media";
export { createTestPlatform, createTestSession, heldAccess } from "./platform";
export type { TestPlatformOptions, TestSessionOptions } from "./platform";
export { jsonResponse, routedTransport, scriptedTransport } from "./transport";
export type { Answer, RecordedCall } from "./transport";
