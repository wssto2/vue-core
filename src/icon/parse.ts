/** A parsed SVG element: what `Icon` turns into vnodes. Text nodes are dropped (icons have none). */
export interface SvgNode {
  tag: string;
  attrs: Record<string, string>;
  children: SvgNode[];
}

// Pure memoisation of `parseSvg` by its input string, not application state: the same source
// always yields the same tree, and an icon set is a few hundred short strings.
const parsed = new Map<string, SvgNode | null>();

function toNode(element: Element): SvgNode {
  const attrs: Record<string, string> = {};
  for (const attribute of Array.from(element.attributes)) attrs[attribute.name] = attribute.value;

  return {
    tag: element.localName,
    attrs,
    children: Array.from(element.children).map(toNode),
  };
}

/** Parses an SVG source string; `null` when it is not an SVG document. */
export function parseSvg(source: string): SvgNode | null {
  const known = parsed.get(source);
  if (known !== undefined) return known;

  const root = new DOMParser().parseFromString(source, "image/svg+xml").documentElement;
  const node = root.localName === "svg" && !root.querySelector("parsererror") ? toNode(root) : null;
  parsed.set(source, node);

  return node;
}
