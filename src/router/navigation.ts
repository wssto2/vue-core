import { computed, type ComputedRef } from "vue";
import type { RouteLocationRaw, Router } from "vue-router";
import { defineFeatureContext } from "../platform/context";
import type { NavigationNode } from "../platform/navigation";
import type { Session } from "../platform/session";
import type { Destination } from "./index";

/**
 * Connects a destination the backend's menu names to a route of the application. The backend owns the
 * menu (grouping, order, who sees what); the frontend only says where each destination lives.
 */
export interface NavigationBinding {
  readonly destination: Destination;
  /** The route it opens: a `defineRoutes` target such as `ticketRoutes.index`. */
  readonly to: RouteLocationRaw;
  /** Route names under which the destination stays highlighted: the record pages of a list destination. */
  readonly within?: readonly string[];
}

/** A binding with the feature that declared it, for error messages. */
export interface OwnedNavigationBinding {
  readonly feature: string;
  readonly binding: NavigationBinding;
}

export interface NavigationValidation {
  /** Every destination the application can open. */
  readonly destinations: ReadonlyMap<Destination, OwnedNavigationBinding>;
  /** Problems found; empty when the bindings are sound. */
  readonly issues: readonly string[];
}

export interface NavigationCatalogue {
  /**
   * Every destination the backend's menu can contain (from its compiled navigation, not the current
   * user's filtered tree). A binding for a destination outside it is a typo or a removed destination.
   */
  readonly known?: readonly Destination[];
  /** Destinations that must have a binding: the application cannot work without them. */
  readonly required?: readonly Destination[];
}

/** Checks the bindings of all features together: one binding per destination, and the catalogue's rules. */
export function bindNavigation(bindings: readonly OwnedNavigationBinding[], catalogue: NavigationCatalogue = {}): NavigationValidation {
  const destinations = new Map<Destination, OwnedNavigationBinding>();
  const issues: string[] = [];
  for (const owned of bindings) {
    const { destination } = owned.binding;
    const earlier = destinations.get(destination);
    if (earlier) {
      issues.push(`The destination "${destination}" is bound twice: by feature "${earlier.feature}" and by feature "${owned.feature}".`);
      continue;
    }
    if (catalogue.known && !catalogue.known.includes(destination)) {
      issues.push(`Feature "${owned.feature}" binds the destination "${destination}", which the backend's navigation does not contain.`);
    }
    destinations.set(destination, owned);
  }
  for (const destination of catalogue.required ?? []) {
    if (!destinations.has(destination)) issues.push(`The destination "${destination}" is required but no feature binds it.`);
  }
  return { destinations, issues };
}

/** One entry of the menu the user sees, resolved through the installed bindings. */
export interface NavigationItem {
  /** Stable across renders: the destination, or the position of a group. */
  readonly key: string;
  readonly label: string;
  readonly icon: string | null;
  /** Where it goes; null for a group. */
  readonly to: RouteLocationRaw | null;
  /** The current page belongs to this destination, or to one of its children. */
  readonly active: boolean;
  readonly children: readonly NavigationItem[];
}

export interface NavigationOptions {
  session: Session;
  router: Router;
  /** The application's vue-i18n `global` composer. */
  i18n: { t(key: string): string; te(key: string): boolean };
  destinations: ReadonlyMap<Destination, OwnedNavigationBinding>;
}

/**
 * The server's menu for the signed-in user, resolved through the bindings. A destination with no
 * binding (its feature is not installed) is left out, with whatever is under it: never a link that
 * goes nowhere. A group left empty is left out too. Reactive to the session, the locale and the route.
 */
export function createNavigation(options: NavigationOptions): ComputedRef<readonly NavigationItem[]> {
  const { session, router, i18n, destinations } = options;

  const label = (node: NavigationNode) => (i18n.te(node.i18n) ? i18n.t(node.i18n) : node.i18n);

  function resolve(nodes: readonly NavigationNode[], path: string): NavigationItem[] {
    return nodes.flatMap((node, index): NavigationItem[] => {
      const key = `${path}/${node.route ?? index}`;
      const children = resolve(node.children ?? [], key);
      if (node.route === undefined) return children.length > 0 ? [item(node, key, null, children, false)] : [];

      const bound = destinations.get(node.route);
      if (!bound) return [];
      const { to, within = [] } = bound.binding;
      const inside = within.some((name) => router.currentRoute.value.matched.some((record) => record.name === name));
      return [item(node, key, to, children, inside || isCurrent(to))];
    });
  }

  function isCurrent(to: RouteLocationRaw): boolean {
    const target = router.resolve(to).matched.at(-1);
    return target !== undefined && router.currentRoute.value.matched.includes(target);
  }

  const item = (node: NavigationNode, key: string, to: RouteLocationRaw | null, children: NavigationItem[], active: boolean): NavigationItem => ({
    key,
    label: label(node),
    icon: node.icon ?? null,
    to,
    active: active || children.some((child) => child.active),
    children,
  });

  return computed(() => {
    const state = session.state.value;
    return state.status === "authenticated" ? resolve(state.navigation ?? [], "") : [];
  });
}

/** The resolved menu of the application; installed by `createApplication`. */
export const [navigationKey, useNavigation] = defineFeatureContext<ComputedRef<readonly NavigationItem[]>>("vue-core.navigation");
