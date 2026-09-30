/**
 * The filled control surface of a grouped row (decision D17, E1 · T1 · O1).
 *
 * One class-list source for every editable value in a FormGroup row on desktop:
 * text and number fields, the textarea, the select pop-up button and the date
 * capsule share the fill, radius, focus ring, error and locked states, so a form
 * scans as one column of the same control. Only semantic tokens.
 *
 * Desktop only. Every desktop class is paired with its `compact:` counterpart,
 * which restores today's phone / touch presentation: text and textarea are
 * transparent in the value column, the select is plain text with ⌃⌄, the date
 * stays a capsule. The pairs are the contract (tests/components/form/controlSurface.test.ts).
 *
 * Used by the form fields (text, combo, textarea, select, date) and by `DateButton` here.
 */

/** What the control is: typed text, multi-line text, a pop-up (select) or a date capsule. */
export type ControlKind = "text" | "area" | "popup" | "date";
/** Focus and hover are CSS states on top of these (`focus-within:`, `hover:`). */
export type ControlState = "rest" | "error" | "locked";
/** sm 10rem (numbers, units) · md 18rem (text, codes) · lg 22rem · full (to the row edge) · content (pickers). */
export type ControlWidth = "sm" | "md" | "lg" | "full" | "content";

/** A desktop class list and the compact classes that undo or restate it. */
export type ClassPair = readonly [desktop: string, compact: string];

/** Kinds that turn into plain text on compact screens (the others keep their capsule). */
const PLAIN_ON_COMPACT: Record<ControlKind, boolean> = { text: true, area: true, popup: true, date: false };

/**
 * Classes with no visible effect on their own (motion, the radius of a transparent
 * control), exempt from pairing.
 */
const SHARED = "rounded-control transition-[background-color,box-shadow,opacity] duration-motion-fast ease-motion-standard";

/** The content inset inside the fill. Pickers keep their own (value + ⌃⌄). */
const INSET: Record<ControlKind, ClassPair | null> = {
  text: ["px-2.5", "compact:px-0"],
  area: ["px-2.5", "compact:px-0"],
  popup: null,
  date: null,
};

/** Today's picker focus on compact: a keyboard outline around the button itself. */
const COMPACT_PICKER_FOCUS =
  "compact:focus-within:ring-0 compact:focus-within:outline-0 compact:focus-visible:outline-2 compact:focus-visible:outline-offset-2 compact:focus-visible:outline-border-focus";

// Written out so Tailwind generates every class: a 1.5px ring and a soft halo in the state's tone.
const FOCUS_RING = {
  rest: "focus-within:ring-[1.5px] focus-within:ring-inset focus-within:ring-border-focus focus-within:outline-3 focus-within:outline-border-focus/20",
  error: "focus-within:ring-[1.5px] focus-within:ring-inset focus-within:ring-border-destructive focus-within:outline-3 focus-within:outline-border-destructive/20",
} as const;

function focusPairs(kind: ControlKind, error: boolean): ClassPair[] {
  const plain = PLAIN_ON_COMPACT[kind];
  const typed = kind === "text" || kind === "area";
  const pairs: ClassPair[] = [
    [FOCUS_RING[error ? "error" : "rest"], typed ? "compact:focus-within:ring-0 compact:focus-within:outline-0" : COMPACT_PICKER_FOCUS],
  ];
  // Typing happens on the cell colour; a picker keeps its fill while its menu is open.
  if (typed && !error) pairs.push(["focus-within:bg-surface-cell", plain ? "compact:focus-within:bg-transparent" : "compact:focus-within:bg-fill"]);
  return pairs;
}

const typedKind = (kind: ControlKind) => kind === "text" || kind === "area";

/** The desktop/compact pairs for one control; `controlSurface` joins them. */
export function controlSurfacePairs(kind: ControlKind, state: ControlState): ClassPair[] {
  const plain = PLAIN_ON_COMPACT[kind];
  const pairs: ClassPair[] = [];
  const inset = INSET[kind];
  if (inset) pairs.push(inset);

  if (state === "locked") {
    // O1: the control's shape at 45 %, nothing to hover or focus. Compact screens
    // render a value row for a locked field (BaseField); a disabled one keeps today's
    // look there: a typed field is plain, a picker stays dimmed.
    pairs.push(["bg-fill", plain ? "compact:bg-transparent" : "compact:bg-fill"]);
    pairs.push(["opacity-45 cursor-not-allowed", typedKind(kind) ? "compact:opacity-100 compact:cursor-auto" : "compact:opacity-45 compact:cursor-not-allowed"]);
    return pairs;
  }

  if (state === "error") {
    // The popup keeps its danger fill on compact (today); typed fields show only the message there.
    pairs.push(["bg-status-danger-surface", kind === "text" || kind === "area" ? "compact:bg-transparent" : "compact:bg-status-danger-surface"]);
    pairs.push(["ring-[1.5px] ring-inset ring-border-destructive", "compact:ring-0"]);
    pairs.push(...focusPairs(kind, true));
    return pairs;
  }

  pairs.push(["bg-fill", plain ? "compact:bg-transparent" : "compact:bg-fill"]);
  pairs.push(["hover:bg-fill-strong", plain ? "compact:hover:bg-transparent" : "compact:hover:bg-fill-strong"]);
  pairs.push(...focusPairs(kind, false));
  return pairs;
}

/**
 * The surface class list for a row control.
 *
 *   <div :class="controlSurface({ kind: 'text', state: error ? 'error' : 'rest' })">
 *     <input class="bg-transparent …" />
 *   </div>
 */
export function controlSurface({ kind, state = "rest" }: { kind: ControlKind; state?: ControlState }): string {
  return [SHARED, ...controlSurfacePairs(kind, state).flat()].join(" ");
}

const WIDTH: Record<ControlWidth, ClassPair> = {
  sm: ["w-40 max-w-full", "compact:w-full compact:max-w-full"],
  md: ["w-72 max-w-full", "compact:w-full compact:max-w-full"],
  lg: ["w-88 max-w-full", "compact:w-full compact:max-w-full"],
  full: ["w-full", "compact:w-full"],
  content: ["max-w-full", "compact:max-w-full"],
};

/** Width of a row control by kind of value, so a form scans as one column. Compact fills the value column. */
export function controlWidthPair(width: ControlWidth): ClassPair {
  return WIDTH[width];
}

export function controlWidth(width: ControlWidth): string {
  return WIDTH[width].join(" ");
}
