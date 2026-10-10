import type { Tone } from "../state";

/** One choice of a select, chips, segments or cards. `Value` is what lands in the form. */
export interface SelectOption<Value extends string | number = string | number, Meta = undefined> {
  readonly value: Value;
  readonly label: string;
  /** A caption at the end of the row (tells equal names apart). */
  readonly description?: string;
  /** A status dot before the label, in the tone's colour. */
  readonly dot?: Tone;
  readonly disabled?: boolean;
  /** Options with the same group are listed together, under its name, in the order the groups first appear. */
  readonly group?: string;
  /** Whatever else the app knows about the option (a vehicle's VIN and photo, a category); typed through `#option`. */
  readonly meta?: Meta;
}

/** An option whose `meta` is there: what the `#option` slot reads. */
export type OptionWithMeta<Value extends string | number, Meta> = SelectOption<Value, Meta> & { readonly meta: Meta };

/** What a `#value` slot receives: the chosen option, with the `meta` the app gave it. Only rendered while an option is chosen. */
export interface ValueSlotScope<Value extends string | number, Meta = undefined> {
  readonly option: OptionWithMeta<Value, Meta>;
}

/** What an `#option` slot receives for one row: the option, whether it is the highlighted (or focused) row, and whether it is the chosen one. */
export interface OptionSlotScope<Value extends string | number, Meta = undefined> {
  /** The row's option, with the `meta` the app gave it (give every option one when the slot reads it). */
  readonly option: OptionWithMeta<Value, Meta>;
  readonly active: boolean;
  readonly selected: boolean;
}

export interface OptionGroup<Value extends string | number, Meta = undefined> {
  readonly title: string | null;
  readonly options: readonly SelectOption<Value, Meta>[];
}

/** The options split into their groups, in order; ungrouped ones first, under no title. */
export function groupOptions<Value extends string | number, Meta = undefined>(options: readonly SelectOption<Value, Meta>[]): readonly OptionGroup<Value, Meta>[] {
  const groups = new Map<string | null, SelectOption<Value, Meta>[]>();
  for (const option of options) {
    const key = option.group ?? null;
    const list = groups.get(key) ?? [];
    list.push(option);
    groups.set(key, list);
  }
  return [...groups.entries()].sort(([a], [b]) => (a === null ? -1 : b === null ? 1 : 0)).map(([title, list]) => ({ title, options: list }));
}

/** Options whose label contains the text, ignoring case and accents. */
export function matchOptions<Value extends string | number, Meta = undefined>(options: readonly SelectOption<Value, Meta>[], query: string): readonly SelectOption<Value, Meta>[] {
  const needle = foldText(query.trim());
  return needle === "" ? options : options.filter((option) => foldText(option.label).includes(needle) || (option.description !== undefined && foldText(option.description).includes(needle)));
}

/** The text without case and accents: what matching compares. */
export const foldText = (text: string): string => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase();
