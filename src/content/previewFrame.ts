/** The widths a page is previewed at, in CSS pixels. */
export const PREVIEW_WIDTHS = { desktop: 1280, tablet: 768, mobile: 375 } as const;
export type PreviewDevice = keyof typeof PREVIEW_WIDTHS;

/**
 * How much a page rendered at `width` px must shrink to fit `available` px: never above 1 (a narrow page is not stretched), and 1 while
 * the pane has not been measured yet.
 */
export function previewScale(available: number, width: number): number {
  if (!(available > 0) || !(width > 0)) return 1;
  return Math.min(1, available / width);
}

/**
 * What the previewed page tells the editor, as `window.parent.postMessage(action, origin)` from the page's own script: the edit,
 * delete, add, reorder, duplicate and copy-locale buttons the page draws on its components. `id` names the component.
 */
export type PreviewAction =
  | { type: "edit"; id: string }
  | { type: "delete"; id: string }
  | { type: "duplicate"; id: string }
  /** A new component after the one `after` names; without it, at the start. */
  | { type: "add"; after?: string }
  /** The component moves to position `to` (from 0). */
  | { type: "reorder"; id: string; to: number }
  /** Fill the component's current language with the text of `from`. */
  | { type: "copy-locale"; id: string; from: string };

/** What the editor tells the page, through `PreviewFrame.post()`: anything with a `type`. */
export type PreviewCommand = { type: string; [key: string]: unknown };

const ACTIONS = new Set<string>(["edit", "delete", "duplicate", "add", "reorder", "copy-locale"]);
const isText = (value: unknown): value is string => typeof value === "string";

/** The default reading of a message from the page: one of `PreviewAction`, with the fields its kind needs, or null. */
export function parsePreviewAction(data: unknown): PreviewAction | null {
  if (typeof data !== "object" || data === null) return null;
  const message = data as Record<string, unknown>;
  if (!isText(message.type) || !ACTIONS.has(message.type)) return null;
  switch (message.type) {
    case "add": return message.after === undefined || isText(message.after) ? { type: "add", ...(isText(message.after) && { after: message.after }) } : null;
    case "reorder": return isText(message.id) && typeof message.to === "number" ? { type: "reorder", id: message.id, to: message.to } : null;
    case "copy-locale": return isText(message.id) && isText(message.from) ? { type: "copy-locale", id: message.id, from: message.from } : null;
    default: return isText(message.id) ? ({ type: message.type, id: message.id } as PreviewAction) : null;
  }
}
