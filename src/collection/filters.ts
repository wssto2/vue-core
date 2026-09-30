import type { IconName } from "../icon";

export interface FilterOption {
  value: string | number;
  label: string;
  icon?: IconName;
  /** For a filter with `dependsOn`: the parent value this option belongs to; offered only while the parent is empty or includes it. */
  parentValue?: string | number;
}

/**
 * How a filter is offered (what it offers, not whether the backend supports it: that is the
 * definition's query contract).
 *
 * - `select`: a capsule in the toolbar with a menu of options.
 * - `text`: a capsule opening a small field for a free value (a code, a chassis number).
 * - `segmented`: a single choice as a segmented control (panel only).
 * - `range`: a "from,until" numeric pair (panel only); either side may be empty.
 */
export interface FilterDescriptor<Filter extends string = string> {
  key: Filter;
  label: string;
  type: "select" | "text" | "segmented" | "range";
  options?: readonly FilterOption[];
  icon?: IconName;
  /** `panel` moves the filter into the filter panel (a sheet behind a "Filters" button) instead of a toolbar capsule. Default `toolbar`. */
  placement?: "toolbar" | "panel";
  /** Leaves out the "Show all" entry. */
  withoutDefaultOption?: boolean;
  /** The text of the "Show all" entry. */
  defaultOptionTitle?: string;
  /**
   * The filter this one narrows under (brand under category). Changing the parent clears this one.
   * Options sharing a label once narrowed are merged into one whose value is their comma-joined
   * values, so the backend receives a list.
   */
  dependsOn?: Filter;
  /** `range`: the unit shown after each input (a currency symbol). */
  unit?: string;
  /** `range`: decimal places the inputs accept. Default 0. */
  decimals?: number;
}

/** A scope over one list (a tab). `count` is overlaid by what the server reports for the view. */
export interface ViewDescriptor<View extends string = string> {
  key: View;
  label: string;
  icon?: IconName;
  count?: number;
}

export const isEmptyFilterValue = (value: unknown): boolean => value === undefined || value === null || value === "";

/** "2018,2022" becomes ["2018", "2022"]; either side may be null. */
export function splitRange(value: string | null | undefined): [string | null, string | null] {
  if (!value) return [null, null];
  const [from = "", until = ""] = String(value).split(",");
  return [from.trim() || null, until.trim() || null];
}

/** The inverse of `splitRange`; null when both sides are empty. */
export function joinRange(from: string | number | null | undefined, until: string | number | null | undefined): string | null {
  const left = isEmptyFilterValue(from) ? "" : String(from);
  const right = isEmptyFilterValue(until) ? "" : String(until);
  return left === "" && right === "" ? null : `${left},${right}`;
}

/**
 * The options a dependent filter offers for the current parent value, with options sharing a label
 * merged into one whose value is the comma-joined values ("Renault" under two categories becomes
 * "10,12"). A parent value may itself be such a list, so it is split before matching.
 */
export function narrowedOptions(filter: FilterDescriptor, parentValue: string | number | null | undefined): { value: string; label: string }[] {
  const parents = isEmptyFilterValue(parentValue) ? null : new Set(String(parentValue).split(","));
  const visible = (filter.options ?? []).filter(
    (option) => !filter.dependsOn || !parents || (option.parentValue !== undefined && parents.has(String(option.parentValue))),
  );

  const merged = new Map<string, string[]>();
  for (const option of visible) {
    const values = merged.get(option.label) ?? [];
    const value = String(option.value);
    if (!values.includes(value)) values.push(value);
    merged.set(option.label, values);
  }
  return [...merged.entries()].map(([label, values]) => ({ label, value: values.join(",") }));
}

/** An applied filter as a removable token. */
export interface FilterChip {
  /** Stable key: the first filter of the chip. */
  key: string;
  /** Muted caption; null for a hierarchy chip, whose values speak for themselves. */
  label: string | null;
  /** One entry per level; a hierarchy chip renders them with separators. */
  values: string[];
  /** The filters the chip's remove button clears. */
  clears: string[];
}

export interface ChipWords {
  formatNumber: (value: number) => string;
  from: string;
  until: string;
}

/** The display text of one applied panel filter, or null when it has no value. */
export function filterValueLabel(filter: FilterDescriptor, value: unknown, words: ChipWords): string | null {
  if (isEmptyFilterValue(value)) return null;

  if (filter.type === "range") {
    const [from, until] = splitRange(String(value));
    // Only amounts get thousands separators: a year must read "2018", not "2.018".
    const unit = filter.unit ? ` ${filter.unit}` : "";
    const show = (part: string) => `${filter.unit ? words.formatNumber(Number(part)) : part}${unit}`;
    if (from !== null && until !== null) return `${show(from)} – ${show(until)}`;
    if (from !== null) return `${words.from.toLowerCase()} ${show(from)}`;
    if (until !== null) return `${words.until.toLowerCase()} ${show(until)}`;
    return null;
  }

  const values = new Set(String(value).split(","));
  return (filter.options ?? []).find((option) => values.has(String(option.value)))?.label ?? String(value);
}

/**
 * Chips for applied filters. A `dependsOn` chain (category, brand, model) collapses into one chip,
 * since "Cars › Renault › Austral" reads better than three unlabelled ones; its remove button clears the chain.
 */
export function filterChips(filters: readonly FilterDescriptor[], selected: Readonly<Record<string, unknown>>, words: ChipWords): FilterChip[] {
  const keys = new Set(filters.map((filter) => filter.key));
  const childOf = (key: string) => filters.find((filter) => filter.dependsOn === key);
  const chips: FilterChip[] = [];

  for (const root of filters.filter((filter) => !filter.dependsOn || !keys.has(filter.dependsOn))) {
    const chain: FilterDescriptor[] = [];
    // `seen` stops a mistaken cycle (a depends on b depends on a) from looping forever.
    for (let node: FilterDescriptor | undefined = root; node && !chain.includes(node); node = childOf(node.key)) chain.push(node);

    const applied = chain
      .map((filter) => ({ filter, value: filterValueLabel(filter, selected[filter.key], words) }))
      .filter((entry): entry is { filter: FilterDescriptor; value: string } => entry.value !== null);
    if (applied.length === 0) continue;

    chips.push({
      key: root.key,
      label: applied.length === 1 ? applied[0]!.filter.label : null,
      values: applied.map((entry) => entry.value),
      clears: chain.map((filter) => filter.key),
    });
  }
  return chips;
}

/** How many of the filters have a value: the count on the "Filters" button. */
export function appliedFilterCount(filters: readonly FilterDescriptor[], selected: Readonly<Record<string, unknown>>): number {
  return filters.filter((filter) => !isEmptyFilterValue(selected[filter.key])).length;
}
