import type { InjectionKey } from "vue";
import { foldText } from "../form/options";
import type { RowAction } from "./columns";

/** What a `CollectionTree` node is: its id, its name, its children, and whether it is switched on (`undefined`: it has no switch). */
export interface TreeNode<Node> {
  readonly id: string | number;
  readonly label: string;
  readonly active?: boolean;
  readonly children?: readonly Node[];
}

/**
 * A column besides the name. `visible` says where it applies: a column that belongs to one branch ("Kod marke" under Marke) is blank on
 * every other row. The header always shows, so the columns do not jump when a branch opens.
 */
export interface TreeColumn<Node> {
  readonly key: string;
  readonly label: string;
  /** Pixels. */
  readonly width?: number;
  readonly align?: "start" | "center" | "end";
  /** `depth` is 0 for the roots. Default: every row. */
  readonly visible?: (node: Node, depth: number) => boolean;
}

/** What `@reorder` says: the node, the parent it stays in (`null`: a root) and where it lands among that parent's children, counted from 0. */
export interface TreeReorder {
  readonly id: string | number;
  readonly parentId: string | number | null;
  readonly index: number;
}

/**
 * The nodes a search or filter leaves on screen: those that match, and every ancestor of one (a match is never shown without its
 * path). `forced` is the ancestors, which show open while the search lasts.
 */
export function visibleNodes<Node extends TreeNode<Node>>(nodes: readonly Node[], matches: (node: Node) => boolean): { shown: Set<string | number>; forced: Set<string | number> } {
  const shown = new Set<string | number>();
  const forced = new Set<string | number>();
  const walk = (list: readonly Node[]): boolean => {
    let any = false;
    for (const node of list) {
      const below = walk(node.children ?? []);
      if (below) forced.add(node.id);
      if (below || matches(node)) {
        shown.add(node.id);
        any = true;
      }
    }
    return any;
  };
  walk(nodes);
  return { shown, forced };
}

/** Whether a node's name contains the text, ignoring case and accents. */
export const matchesText = (label: string, text: string): boolean => foldText(label).includes(foldText(text.trim()));

/** A node as the branches see it: the typed node of the app, loosely (internal). */
export interface LooseNode extends TreeNode<LooseNode> {
  readonly [key: string]: unknown;
}

/** What `CollectionTree` hands its branches (internal): one object, so the recursion does not repeat a dozen props. */
export interface TreeContext {
  columns: readonly TreeColumn<LooseNode>[];
  readonly: boolean;
  reorderable: boolean;
  search: string;
  activeLabel: string | undefined;
  isOpen(node: LooseNode): boolean;
  isShown(node: LooseNode): boolean;
  toggle(node: LooseNode): void;
  addLabel(parent: LooseNode | null, level: number): string | null;
  add(parent: LooseNode | null): void;
  open(node: LooseNode): void;
  setActive(node: LooseNode, active: boolean): void;
  reorder(change: TreeReorder): void;
  actions(node: LooseNode, depth: number): readonly RowAction[];
  slot(name: string): ((scope: { node: LooseNode; depth: number }) => unknown) | undefined;
}

export const treeContextKey: InjectionKey<TreeContext> = Symbol("vue-core.collection-tree");
