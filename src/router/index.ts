export { createAppHistory, createReplaceOnlyHistory, isIosHomeScreenApp } from "./history";
export { defineRoutes } from "./defineRoutes";
export type { DefinedRoutes, RouteDefinition, RouteParams, RouteTarget } from "./defineRoutes";
export { AppRouterView, firstDenied, routeAccessKey, useRouteAccess } from "./access";
export type { RouteAccess } from "./access";
export { installRouterGuards, returnTo } from "./guards";
export type { RouterGuardOptions } from "./guards";
export { isAllowed } from "./meta";
export { default as NoAccess } from "./NoAccess.vue";
export type { AccessRequirement, RouteSection } from "./meta";
export { bindNavigation, createNavigation, navigationKey, useNavigation } from "./navigation";
export type {
  NavigationBinding,
  NavigationCatalogue,
  NavigationItem,
  NavigationOptions,
  NavigationValidation,
  OwnedNavigationBinding,
} from "./navigation";

/**
 * The navigation destinations of the backend. The library declares none: an app adds its own by
 * augmenting this interface (declaration merging, like `IconRegistry`; later generated from the
 * backend's navigation catalogue), so a binding for a destination that does not exist fails to compile.
 *
 *   declare module "@wssto2/vue-core/router" {
 *     interface DestinationRegistry { "tickets": true; "reports": true }
 *   }
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- an empty interface is the point: apps augment it
export interface DestinationRegistry {}

/** A destination token of the backend's menu; any string until the application declares its own. */
export type Destination = keyof DestinationRegistry extends never ? string : Extract<keyof DestinationRegistry, string>;
