/**
 * One node of the menu the server built for the signed-in user (go-core's navigation tree, already
 * filtered by what the user may see). A node with a `route` is a destination: the route is the
 * backend's token for it (`Destination`), which the application binds to one of its own routes. A node
 * without one is a group of its children.
 *
 * A node with an `href` (and no `route`) is a destination **outside** this application: the old admin, a sibling app. The shell draws
 * it as a plain link with an "opens outside the app" marker and the browser follows it with a full page load, never through the
 * router. `href` is a path on this origin (`/old-admin/pages`) or an absolute `http(s)` URL; anything else (`javascript:`, `//host`) is
 * refused when the session is read. go-core's `navigation.Node` needs one more optional field, `Href string` with the JSON name `href` (omitted when empty),
 * which the application's menu builder sets instead of `Route` for such an entry.
 */
export interface NavigationNode {
  /** The i18n key of the label. */
  readonly i18n: string;
  /** The icon name, when the server says. */
  readonly icon?: string;
  /** The destination token; absent for a group. */
  readonly route?: string;
  /** Where a destination outside the application lives; mutually exclusive with `route`. */
  readonly href?: string;
  readonly children?: readonly NavigationNode[];
}

/** A path on this origin or an absolute http(s) URL: never `javascript:`, `data:` or a protocol-relative `//host`. */
export function isSafeHref(value: string): boolean {
  if (value.startsWith("/")) return !value.startsWith("//") && !value.startsWith("/\\");
  return /^https?:\/\//i.test(value);
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Validates the `navigation` of a session payload; every problem found goes to `issues`. Unknown fields (policies, ...) are dropped. */
export function parseNavigation(raw: unknown, issues: string[], path = "navigation"): readonly NavigationNode[] {
  if (!Array.isArray(raw)) {
    issues.push(`${path}: expected an array`);
    return [];
  }
  return raw.flatMap((entry, index): NavigationNode[] => {
    const here = `${path}[${index}]`;
    if (!isObject(entry) || typeof entry.i18n !== "string") {
      issues.push(`${here}: expected an object with an i18n key`);
      return [];
    }
    for (const key of ["icon", "route", "href"] as const) {
      if (entry[key] != null && typeof entry[key] !== "string") issues.push(`${here}.${key}: expected a string`);
    }
    let href = typeof entry.href === "string" ? entry.href : undefined;
    if (href !== undefined && typeof entry.route === "string") {
      issues.push(`${here}: has both a route and an href; the route is used`);
      href = undefined;
    } else if (href !== undefined && !isSafeHref(href)) {
      issues.push(`${here}.href: expected a path on this origin or an http(s) URL`);
      href = undefined;
    }
    const children = entry.children == null ? undefined : parseNavigation(entry.children, issues, `${here}.children`);
    return [
      {
        i18n: entry.i18n,
        ...(typeof entry.icon === "string" && { icon: entry.icon }),
        ...(typeof entry.route === "string" && { route: entry.route }),
        ...(href !== undefined && { href }),
        ...(children && { children }),
      },
    ];
  });
}
