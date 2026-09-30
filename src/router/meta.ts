import type { IconName } from "../icon";
import type { AccessClient, Permission } from "../platform";

/**
 * What a route needs to be opened: one permission, any of several, or all of several. Routes are
 * protected by default (they need a signed-in session); `access` narrows that to a permission.
 */
export type AccessRequirement = Permission | { readonly any: readonly Permission[] } | { readonly all: readonly Permission[] };

/** A route that is a section of its parent record: what the record's section navigation lists. */
export interface RouteSection {
  /** The i18n key of the section's label. */
  readonly labelKey: string;
  readonly icon: IconName;
}

declare module "vue-router" {
  interface RouteMeta {
    /** Open only for a session that holds this. A denied ancestor denies every route below it. */
    access?: AccessRequirement;
    /** Reachable without a session (login, recovery). Everything else needs one. Inherited by child routes. */
    public?: boolean;
    /** The i18n key of the page title (browser tab and large title). */
    titleKey?: string;
    /** This route is a section of its parent record. */
    section?: RouteSection;
    /** Message namespaces this route needs besides those of the feature that owns it (a shared namespace, a parent's). */
    messages?: readonly string[];
    /** Remount the page when this route parameter changes (a record pager moving to the next record). */
    remountOnParam?: string;
    /** The feature that owns the route. Set by the runtime; do not write it. */
    feature?: string;
  }
}

/** Whether `access` satisfies a requirement. No requirement is satisfied by anyone. */
export function isAllowed(requirement: AccessRequirement | undefined, access: Pick<AccessClient, "can">): boolean {
  if (requirement === undefined) return true;
  if (typeof requirement === "string") return access.can(requirement);
  if ("any" in requirement) return requirement.any.some((permission) => access.can(permission));
  return requirement.all.every((permission) => access.can(permission));
}
