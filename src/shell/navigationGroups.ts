import type { RouteLocationRaw } from "vue-router";
import type { NavigationItem } from "../router/navigation";

/** One link of the menu, as the rail and the drawer draw it. */
export interface NavigationDestination {
  readonly key: string;
  readonly label: string;
  readonly icon: string | null;
  readonly to: RouteLocationRaw;
  /** The current page belongs to this destination (or to one of its sections). */
  readonly active: boolean;
}

export interface NavigationGroup {
  readonly key: string;
  /** Shown only over two or more destinations; a lone one gets a separator instead. */
  readonly heading: string | null;
  /** A hairline above a group without a heading (never above the first group). */
  readonly separated: boolean;
  readonly items: readonly NavigationDestination[];
}

/**
 * The links under a node: the node itself when it is a destination (its own children are sections
 * of it, not more links), otherwise the links of its children, through groups that have no route of
 * their own (the distribution centre holding "Ordered" and "Dispatch").
 */
const linksUnder = (node: NavigationItem): readonly NavigationItem[] => (node.to ? [node] : node.children.flatMap(linksUnder));

/**
 * The menu as the rail and the drawer show it: one group per top-level node, a heading only over two
 * or more links, a hairline between headless groups. A node that is a destination itself is a group
 * of one. A group with no link in it (its destinations are not installed) is left out.
 */
export function groupNavigation(tree: readonly NavigationItem[]): NavigationGroup[] {
  const groups: NavigationGroup[] = [];
  for (const node of tree) {
    const links = linksUnder(node);
    if (links.length === 0) continue;
    const heading = !node.to && links.length > 1 ? node.label : null;
    groups.push({
      key: node.key,
      heading,
      separated: heading === null && groups.length > 0,
      items: links.map((link) => ({ key: link.key, label: link.label, icon: link.icon, to: link.to!, active: link.active })),
    });
  }
  return groups;
}
