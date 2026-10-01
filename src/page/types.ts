import type { RouteLocationRaw } from "vue-router";
import type { KeyboardShortcut } from "../button/shortcut";
import type { IconName } from "../icon";

/** A destination with its label: the back link of a record page. */
export interface PageBack {
  label: string;
  to: RouteLocationRaw;
}

/**
 * One level above the current page in a deep hierarchy: shown as a clickable path in the desktop
 * toolbar. The last item is the parent, which is the back.
 */
export type PagePathItem = PageBack;

/**
 * One page action. The page supplies only actions the user may use; the shared chrome decides where
 * they render:
 *
 * | placement | desktop toolbar / header | phone nav bar |
 * |---|---|---|
 * | `primary` | filled button | bold text button (an icon circle with `compact: "icon"`) |
 * | `secondary` (default) | standard button | "More" menu |
 * | `overflow` | "More" menu | "More" menu |
 *
 * `tone: "critical"` makes it red and puts it in the menu; `prominence: "plain"` renders a text
 * button on desktop (Cancel beside Save); `prominence: "standard"` keeps a primary action gray on
 * desktop (Edit in a read-only record's toolbar) while it stays in the phone nav bar.
 */
export interface PageAction {
  id: string;
  label: string;
  icon?: IconName;
  placement?: "primary" | "secondary" | "overflow";
  tone?: "critical";
  prominence?: "standard" | "plain";
  /** Phone nav bar: show only the icon (the label stays its accessible name). */
  compact?: "label" | "icon";
  /** Phone nav bar label when `label` is too long for the bar ("Save" for "Save changes"). */
  shortLabel?: string;
  disabled?: boolean;
  processing?: boolean;
  keyboardShortcut?: KeyboardShortcut;
  onClick: () => void;
}

/** A shortcut under a record title: Call, E-mail. A link when `href` is set. */
export interface QuickAction {
  id: string;
  label: string;
  icon: IconName;
  href?: string;
  onClick?: () => void;
}

/**
 * Set by a section navigator inside a record page; `null` restores the page's own back.
 * - A nested section on compact screens (drill-in rows): "‹ Auto Split" leads to the record's
 *   first section instead of the list.
 * - A page inside a section, on every width: "‹ Locations" leads to the section; `path` continues
 *   the page's own back or path on desktop ("Dealers › Auto Split › Locations").
 */
export interface PageSectionBack extends PageBack {
  path?: readonly PagePathItem[];
}

/** What a long form says about one of its sections: fields with an error, and its required fields (the page's section list shows both). */
export interface SectionFormState {
  readonly errors: number;
  readonly required: { readonly total: number; readonly filled: number };
}

/**
 * Where one step of a workflow record stands, for the `steps` of `SectionNavigator`: done, and one line under its label
 * ("Missing: market comparison") in a tone. `shortSub` is the line on phones when `sub` is too long for a tile.
 */
export interface SectionStep {
  readonly done: boolean;
  readonly sub?: string;
  readonly shortSub?: string;
  readonly tone?: "positive" | "warning" | "critical";
}
