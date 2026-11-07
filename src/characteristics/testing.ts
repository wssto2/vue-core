// Fixtures for this folder's tests; the declaration build excludes it.
import type { DescriptionResponse, FieldResponse, ItemResponse, LevelResponse } from "../modules/characteristics/entities";
import { dataOf, startScreen, type ScreenOptions } from "../identity/testing";
import { characteristicsFeature } from "./feature";

export const CHAR_VIEW = "characteristics:view";
export const CHAR_EDIT = "characteristics:edit";

const label = (hr: string, en = hr) => ({ hr, en });
const level = (n: number, name: [string, string], fields: FieldResponse[] = [], extra: Partial<LevelResponse> = {}): LevelResponse => ({
  level: n, label: label(...name), name_max: 100, has_translations: true, has_order: true, has_active: true, has_meta: false, fields, ...extra,
});
const field = (column: string, name: string, extra: Partial<FieldResponse> = {}): FieldResponse => ({ column, label: label(name), type: "text", choices: [], max: 0, in_list: false, read_only: false, under: null, ...extra });

/** site-builder's: three levels, the brand code on level 3 read-only and for the branch Osnovno > Marke only (level 2, id 1). */
export const siteBuilderDescription: DescriptionResponse = {
  languages: ["hr", "en"],
  levels: [
    level(1, ["Skupina", "Group"], [], { has_active: false }),
    level(2, ["Popis", "List"]),
    level(3, ["Stavka", "Item"], [field("additional_3", "Kod marke", { in_list: true, read_only: true, max: 64, under: { level: 2, id: 1 } })]),
  ],
};

/** arv-next's: four levels, an editable portal id on level 4 for one branch, shown in no list. */
export const arvDescription: DescriptionResponse = {
  languages: ["hr", "en"],
  levels: [
    level(1, ["Skupina", "Group"], [], { has_active: false }),
    level(2, ["Kategorija", "Category"]),
    level(3, ["Podkategorija", "Subcategory"]),
    level(4, ["Stavka", "Item"], [
      field("portal_id", "Integracijski ID (portal)", { max: 20, under: { level: 3, id: 1 } }),
      field("fuel", "Gorivo", { type: "choice", choices: [{ value: "d", label: label("Dizel", "Diesel") }, { value: "p", label: label("Benzin", "Petrol") }], under: { level: 3, id: 1 } }),
    ]),
  ],
};

const item = (level: number, id: number, parent_id: number, name: string, order: number, extra: Partial<ItemResponse> = {}): ItemResponse => ({
  level, id, parent_id, name, translations: { hr: name, en: name }, order, active: true, meta: {}, values: {}, ...extra,
});

export const siteBuilderItems: ItemResponse[] = [
  item(1, 1, 0, "Novosti", 1),
  item(2, 3, 1, "Akcije", 1),
  item(1, 2, 0, "Osnovno", 2),
  item(2, 1, 2, "Marke", 1),
  item(3, 10, 1, "Renault", 1, { values: { additional_3: "renault" } }),
  item(3, 11, 1, "Dacia", 2, { values: { additional_3: "dacia" } }),
  item(3, 12, 1, "Škoda", 3, { active: false, values: { additional_3: "skoda" } }),
  item(2, 2, 2, "Države", 2),
  item(3, 20, 2, "Hrvatska", 1),
  item(1, 3, 0, "Webshop", 3),
];

export const arvItems: ItemResponse[] = [
  item(1, 1, 0, "Vozila", 1),
  item(2, 1, 1, "Osobna", 1),
  item(3, 1, 1, "Gorivo", 1),
  item(4, 1, 1, "Dizel", 1, { values: { portal_id: "D-1", fuel: "d" } }),
  item(3, 2, 1, "Pogon", 2),
  item(4, 2, 2, "Prednji", 1),
];

export interface CharacteristicsScreen {
  permissions: readonly string[];
  description: DescriptionResponse;
  items: readonly ItemResponse[];
  /** More answers of the fake server, over the defaults. */
  answers?: ScreenOptions["answers"];
  locale?: string;
}

/** The characteristics screen on a fake server that serves the description and the tree. */
export function startCharacteristics(options: CharacteristicsScreen) {
  return startScreen({
    permissions: options.permissions,
    location: "/characteristics",
    answers: {
      "GET /v1/characteristics": dataOf({ items: options.items }),
      "GET /v1/characteristics/description": dataOf(options.description),
      ...options.answers,
    },
    features: [characteristicsFeature()],
  });
}
