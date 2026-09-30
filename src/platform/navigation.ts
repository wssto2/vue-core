/**
 * One node of the menu the server built for the signed-in user (go-core's navigation tree, already
 * filtered by what the user may see). A node with a `route` is a destination: the route is the
 * backend's token for it (`Destination`), which the application binds to one of its own routes. A node
 * without one is a group of its children.
 */
export interface NavigationNode {
  /** The i18n key of the label. */
  readonly i18n: string;
  /** The icon name, when the server says. */
  readonly icon?: string;
  /** The destination token; absent for a group. */
  readonly route?: string;
  readonly children?: readonly NavigationNode[];
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
    for (const key of ["icon", "route"] as const) {
      if (entry[key] != null && typeof entry[key] !== "string") issues.push(`${here}.${key}: expected a string`);
    }
    const children = entry.children == null ? undefined : parseNavigation(entry.children, issues, `${here}.children`);
    return [
      {
        i18n: entry.i18n,
        ...(typeof entry.icon === "string" && { icon: entry.icon }),
        ...(typeof entry.route === "string" && { route: entry.route }),
        ...(children && { children }),
      },
    ];
  });
}
