import type { FieldKind, FormSchema, SchemaField } from "../form/dynamic/schema";
import type { FilterDescriptor } from "./filters";

/** Kinds that read as a cell of a list. Long text, rich text and nested rows stay in the record. */
const LISTED: readonly FieldKind[] = ["text", "number", "boolean", "select", "multi_select", "date", "datetime", "image", "document", "gallery"];
/** Kinds the backend can order by: one value per record, not translated. */
const SORTED: readonly FieldKind[] = ["text", "number", "boolean", "select", "date", "datetime"];
const FILTERED: readonly FieldKind[] = ["select", "boolean", "date", "datetime"];

/** The fields shown as columns: `only` (in its order), else every listable field of the schema. */
export function listedFields(schema: FormSchema, only?: readonly string[]): SchemaField[] {
  if (only) return only.flatMap((key) => schema.fields.filter((field) => field.key === key));
  return schema.fields.filter((field) => LISTED.includes(field.kind));
}

export const isSortable = (field: SchemaField): boolean => SORTED.includes(field.kind) && !field.translatable;
export const isFilterable = (field: SchemaField): boolean => FILTERED.includes(field.kind) && !field.translatable;

/** The text of a cell value: a translated text (`{ hr, en }`) in `locale`, else the first language written; anything else as it is. */
export function textOf(value: unknown, locale: string): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && !Array.isArray(value)) {
    const texts = value as Record<string, unknown>;
    const wanted = texts[locale];
    if (typeof wanted === "string" && wanted !== "") return wanted;
    return Object.values(texts).find((text): text is string => typeof text === "string" && text !== "") ?? "";
  }
  return String(value);
}

/** What a select-like filter offers for a field; a boolean offers yes and no as "true" and "false". */
export function optionsOf(field: SchemaField, labels: { yes: string; no: string }): FilterDescriptor["options"] {
  if (field.kind === "boolean") return [{ value: "true", label: labels.yes }, { value: "false", label: labels.no }];
  return (field.options ?? []).map((option) => ({ value: option.value, label: option.label }));
}
