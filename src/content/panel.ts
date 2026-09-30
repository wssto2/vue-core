import type { IconName } from "../icon";

/** What a `Panel` takes (and `SectionPanel`, which is a panel that the section list links to). */
export interface PanelProps {
  title?: string;
  icon?: IconName;
  /** A section number shown before the title ("01"). */
  number?: string;
  /** A quieter line after the title, from `sm` up. */
  subtitle?: string;
  presentation?: "card" | "section";
  collapsible?: boolean;
  /** The body has no padding (a table or a list that brings its own). */
  flush?: boolean;
  /** The level of the title's heading. */
  headingLevel?: 2 | 3 | 4;
}
