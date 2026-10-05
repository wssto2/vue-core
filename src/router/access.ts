import { computed, defineComponent, h, inject, provide, type Component, type ComputedRef, type InjectionKey } from "vue";
import { RouterView, type RouteLocationNormalizedLoaded, type Router } from "vue-router";
import { defineFeatureContext } from "../platform/context";
import type { AccessClient } from "../platform/access";
import { isAllowed } from "./meta";
import { pageRefreshKey } from "./pageRefresh";

/**
 * The index in `route.matched` of the first record the session may not open, or -1. A denied record
 * denies every record below it, so a child cannot be opened through a parent it may not see.
 */
export function firstDenied(route: Pick<RouteLocationNormalizedLoaded, "matched">, access: Pick<AccessClient, "can">): number {
  return route.matched.findIndex((record) => !isAllowed(record.meta.access, access));
}

export interface RouteAccess {
  /** `firstDenied` of the current route; follows the router and the session's access, so a permission refresh applies at once. */
  readonly deniedFrom: ComputedRef<number>;
  /** What stands where a denied page would be. */
  readonly noAccess: Component;
}

export function createRouteAccess(options: { router: Router; access: AccessClient; noAccess: Component }): RouteAccess {
  return {
    deniedFrom: computed(() => firstDenied(options.router.currentRoute.value, options.access)),
    noAccess: options.noAccess,
  };
}

/** The route access of the application: installed by `createApplication`, read by `AppRouterView`. */
export const [routeAccessKey, useRouteAccess] = defineFeatureContext<RouteAccess>("vue-core.routeAccess");

const depthKey: InjectionKey<number> = Symbol("vue-core.routerViewDepth");

/**
 * The router outlet of an application. Every outlet of a routed layout (the shell's, and a record
 * page's section outlet) is an `AppRouterView`, not a bare `RouterView`: it shows the no-access state
 * in place of a page the session may not open (parents around it keep rendering, so the layout stays),
 * and remounts a page when the route parameter named by `meta.remountOnParam` changes (a record pager
 * moving to the next record), or when the shell's pull to refresh reloads the page (the shell's outlet only).
 *
 * Denial is shown here, not enforced: the server authorizes every request.
 */
export const AppRouterView = defineComponent({
  name: "AppRouterView",
  setup() {
    const depth = inject(depthKey, 0);
    provide(depthKey, depth + 1);
    const access = useRouteAccess();
    const refreshed = depth === 0 ? inject(pageRefreshKey, null) : null;
    return () =>
      h(RouterView, null, {
        default: ({ Component, route }: { Component: Component | undefined; route: RouteLocationNormalizedLoaded }) => {
          const denied = access.deniedFrom.value;
          if (denied !== -1 && depth >= denied) return h(access.noAccess);
          if (!Component) return null;
          const param = route.meta.remountOnParam;
          const key = [param ? `${param}:${String(route.params[param])}` : "", refreshed?.value ? `refresh:${refreshed.value}` : ""].filter(Boolean).join("|");
          return h(Component, { key: key || undefined });
        },
      });
  },
});
