import type { Tone } from "../state";

/** One choice of a select, chips, segments or cards. `Value` is what lands in the form. */
export interface SelectOption<Value extends string | number = string | number> {
  readonly value: Value;
  readonly label: string;
  /** A caption at the end of the row (tells equal names apart). */
  readonly description?: string;
  /** A status dot before the label, in the tone's colour. */
  readonly dot?: Tone;
  readonly disabled?: boolean;
  /** Options with the same group are listed together, under its name, in the order the groups first appear. */
  readonly group?: string;
}

export interface OptionGroup<Value extends string | number> {
  readonly title: string | null;
  readonly options: readonly SelectOption<Value>[];
}

/** The options split into their groups, in order; ungrouped ones first, under no title. */
export function groupOptions<Value extends string | number>(options: readonly SelectOption<Value>[]): readonly OptionGroup<Value>[] {
  const groups = new Map<string | null, SelectOption<Value>[]>();
  for (const option of options) {
    const key = option.group ?? null;
    const list = groups.get(key) ?? [];
    list.push(option);
    groups.set(key, list);
  }
  return [...groups.entries()].sort(([a], [b]) => (a === null ? -1 : b === null ? 1 : 0)).map(([title, list]) => ({ title, options: list }));
}

/** Options whose label contains the text, ignoring case and accents. */
export function matchOptions<Value extends string | number>(options: readonly SelectOption<Value>[], query: string): readonly SelectOption<Value>[] {
  const needle = foldText(query.trim());
  return needle === "" ? options : options.filter((option) => foldText(option.label).includes(needle) || (option.description !== undefined && foldText(option.description).includes(needle)));
}

/** The text without case and accents: what matching compares. */
export const foldText = (text: string): string => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase();
