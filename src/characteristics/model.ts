import type { TreeColumn, TreeNode } from "../collection";
import type { DescriptionResponse, FieldResponse, ItemResponse, LabelResponse, LevelResponse } from "../modules/characteristics/entities";

/** One item of the tree as the screen draws it. `id` is `"<level>:<id>"`: ids repeat from one level's table to the next. */
export interface CharacteristicNode extends TreeNode<CharacteristicNode> {
  readonly item: ItemResponse;
  readonly level: number;
  /** The items from the root down to this one's parent. */
  readonly ancestors: readonly ItemResponse[];
  readonly children?: readonly CharacteristicNode[];
}

export const keyOf = (level: number, id: number): string => `${level}:${id}`;
export const parseKey = (key: string | number): { level: number; id: number } => {
  const [level = 0, id = 0] = String(key).split(":").map(Number);
  return { level, id };
};

/** A label in the administration's language: Croatian for the Croatian-family locales, English otherwise. */
export const labelIn = (label: LabelResponse, locale: string): string => (/^(hr|bs|sr)/.test(locale) ? label.hr : label.en) || label.hr || label.en;

/** The fields of `level` that apply to an item below `path` (the item's ancestors, and the item itself once it exists): a field with `under` is for one branch only. */
export function fieldsFor(level: LevelResponse, path: readonly { level: number; id: number }[]): readonly FieldResponse[] {
  return level.fields.filter((field) => field.under === null || path.some((step) => step.level === field.under?.level && step.id === field.under.id));
}

/** The tree of the flat, depth-first list the server sends: siblings by `order`, the described levels' extras on `item`. */
export function buildTree(items: readonly ItemResponse[], description: DescriptionResponse): CharacteristicNode[] {
  const below = new Map<string, ItemResponse[]>();
  for (const item of items) {
    const parent = item.level === 1 ? "root" : keyOf(item.level - 1, item.parent_id);
    below.set(parent, [...(below.get(parent) ?? []), item]);
  }
  const deepest = description.levels.length;
  const make = (item: ItemResponse, ancestors: readonly ItemResponse[]): CharacteristicNode => {
    const level = description.levels.find((each) => each.level === item.level);
    const own = [...ancestors, item];
    const children = item.level < deepest ? (below.get(keyOf(item.level, item.id)) ?? []).sort(byOrder).map((child) => make(child, own)) : undefined;
    return { id: keyOf(item.level, item.id), label: item.name, active: level?.has_active ? item.active : undefined, item, level: item.level, ancestors, ...(children ? { children } : {}) };
  };
  return (below.get("root") ?? []).sort(byOrder).map((item) => make(item, []));
}
const byOrder = (a: ItemResponse, b: ItemResponse) => a.order - b.order || a.id - b.id;

/** The columns of the list: every `in_list` field of every level, a column once however many branches describe it. */
export function listColumns(description: DescriptionResponse, locale: string): { column: TreeColumn<CharacteristicNode>; fields: readonly { level: LevelResponse; field: FieldResponse }[] }[] {
  const merged = new Map<string, { label: string; fields: { level: LevelResponse; field: FieldResponse }[] }>();
  for (const level of description.levels) {
    for (const field of level.fields.filter((each) => each.in_list)) {
      const label = labelIn(field.label, locale);
      const group = merged.get(`${field.column}|${label}`) ?? { label, fields: [] };
      group.fields.push({ level, field });
      merged.set(`${field.column}|${label}`, group);
    }
  }
  return [...merged.values()].map((group, index) => ({
    fields: group.fields,
    column: {
      key: `field${index}`,
      label: group.label,
      width: 160,
      visible: (node) => group.fields.some(({ level, field }) => level.level === node.level && fieldsFor(level, [...node.ancestors, node.item]).includes(field)),
    },
  }));
}

/** A value as the list shows it: a choice by its label, a yes/no as words. */
export function displayValue(field: FieldResponse, value: unknown, locale: string, yes: string, no: string): string {
  if (value === null || value === undefined || value === "") return "";
  if (field.type === "yesno") return value === true || value === 1 || value === "1" ? yes : no;
  if (field.type === "choice") {
    const choice = field.choices.find((each) => each.value === String(value));
    return choice ? labelIn(choice.label, locale) : String(value);
  }
  return String(value);
}
