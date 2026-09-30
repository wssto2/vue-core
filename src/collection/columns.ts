import type { IconName } from "../icon";
import type { Tone } from "../state";

type Leaf = string | number | boolean | bigint | symbol | null | undefined | Date | ((...args: never[]) => unknown) | readonly unknown[];

/**
 * The keys a column of `Row` may have: a property, or a path into a nested object
 * (`"phase.assigned_to"`), at most three levels deep.
 */
export type ColumnKey<T, Depth extends readonly unknown[] = []> = Depth["length"] extends 3
  ? never
  : T extends object
    ? {
        [K in Extract<keyof T, string>]: NonNullable<T[K]> extends Leaf
          ? K
          : NonNullable<T[K]> extends object
            ? K | `${K}.${ColumnKey<NonNullable<T[K]>, [...Depth, unknown]>}`
            : K;
      }[Extract<keyof T, string>]
    : never;

/** The value a column key reads from a row. */
export type ColumnValue<T, K extends string> = K extends `${infer Head}.${infer Tail}`
  ? Head extends keyof T
    ? NonNullable<T[Head]> extends object
      ? ColumnValue<NonNullable<T[Head]>, Tail>
      : never
    : never
  : K extends keyof T
    ? T[K]
    : never;

/**
 * Vue reads a dot in a static slot name as a modifier, so the slot of `"phase.assigned_to"` is
 * `#cell-phase_assigned_to`.
 */
export type SlotKey<K extends string> = K extends `${infer Head}.${infer Tail}` ? `${Head}_${SlotKey<Tail>}` : K;

/** Reads the value a column key points at. */
export function valueAt<Row, K extends ColumnKey<Row>>(row: Row, key: K): ColumnValue<Row, K> | undefined {
  let current: unknown = row;
  for (const part of String(key).split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current as ColumnValue<Row, K> | undefined;
}

/**
 * The role a column plays in the phone row (Emerald Native), so one definition drives the table and
 * the phone list:
 * - `primary`: the first line, left: who or what (usually the identity);
 * - `accessory`: the first line, right: a status badge;
 * - `meta`: the quiet second line, in column order;
 * - `hidden`: the table only.
 * A list renders phone rows once any column has a role other than `hidden`; cells receive
 * `compact: true` there. Without roles the list stays a table at every width.
 */
export type MobileRole = "primary" | "accessory" | "meta" | "hidden";

interface ColumnCommon<Row, Sort extends string> {
  key: ColumnKey<Row>;
  label: string;
  /** The backend sort key. Setting it makes the header sortable; the list sorts by this, not by `key`. */
  sort?: Sort;
  /** Pixels. */
  width?: number;
  align?: "start" | "center" | "end";
  /** Left out of the table below this width, so a list with many columns keeps its status and actions on screen. */
  hideBelow?: "md" | "xl" | "2xl";
  mobile?: MobileRole;
}

/**
 * How the standard kinds render a cell; `custom` (or any column with a `#cell-<key>` slot) is the
 * escape hatch for domain content. A slot always wins over the kind.
 */
export type ColumnKind<Row> =
  /** The value as text. */
  | { kind?: "text" }
  /**
   * A record's name, linking to the record (`recordRoute`), with an optional quiet line under it
   * (an e-mail, a number) whose text stays selectable inside a clickable row. `title` defaults to the value.
   */
  | { kind: "identity"; title?: (row: Row) => string; subtitle?: (row: Row) => string | null | undefined }
  /** A date or date and time through the app's formatting. */
  | { kind: "timestamp"; precision?: "date" | "dateTime" }
  | { kind: "number"; format?: Intl.NumberFormatOptions }
  | { kind: "money"; currency: string | ((row: Row) => string) }
  /** A status: the tone carries the meaning; `text` defaults to the value. */
  | { kind: "badge"; tone: (row: Row) => Tone | "context"; text?: (row: Row) => string }
  | { kind: "custom" };

export type Column<Row, Sort extends string = string> = ColumnCommon<Row, Sort> & ColumnKind<Row>;

/**
 * A list of columns; write it with `satisfies` so the keys stay literal and a wrong one is an error:
 *
 *   const columns = [{ key: "title", label: t("title"), kind: "identity", mobile: "primary" }] satisfies CollectionColumns<Ticket>;
 */
export type CollectionColumns<Row, Sort extends string = string> = readonly Column<Row, Sort>[];

/** A quick action of a row: swiped in on phones (links only) and listed in the row's context menu. */
export interface RowAction {
  key: string;
  label: string;
  icon: IconName;
  /** A link (tel:, mailto:, a route's href): swipeable. */
  href?: string;
  /** A command: menu only. */
  onSelect?: () => void;
  /** The swipe tile's colour; `critical` also puts the item last and red in the menu. */
  tone?: "positive" | "info" | "neutral" | "critical";
  /** An external link opens in a new tab. */
  external?: boolean;
  /** Menu items of another section start a new block after a separator. */
  section?: string;
}
