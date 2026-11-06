/**
 * The typed schema `DynamicForm`, `DynamicCollection` and `buildValidator` are generated from: the shape a content
 * type's definition has in the API (snake_case keys, as the server sends them). It is data, not a page description:
 * a list of fields with a kind, nothing about layout.
 */

/** The kinds a field can have. `image`, `document` and `gallery` hold ids of resources (one, one, several). */
export type FieldKind =
  | "text"
  | "textarea"
  | "rich_text"
  | "number"
  | "boolean"
  | "select"
  | "multi_select"
  | "date"
  | "datetime"
  | "image"
  | "document"
  | "gallery"
  | "collection";

/** One test of a `visible_when` rule: the field named, compared with one operator. */
export type VisibilityCondition =
  | { readonly field: string; readonly eq: unknown }
  | { readonly field: string; readonly ne: unknown }
  | { readonly field: string; readonly in: readonly unknown[] }
  | { readonly field: string; readonly empty: true }
  | { readonly field: string; readonly not_empty: true };

/** When a field shows: every condition of `all` holds, or at least one of `any`. See `evaluateVisibility`. */
export type VisibilityRule = { readonly all: readonly VisibilityCondition[]; readonly any?: undefined } | { readonly any: readonly VisibilityCondition[]; readonly all?: undefined };

export interface SelectChoice {
  readonly value: string | number;
  readonly label: string;
}

/** A rule of the whitelist a field may carry (the server's list, mirrored); `args` is the rule's parameters (`max`: `[150]`). */
export interface FieldRule {
  readonly rule: "required" | "min" | "max" | "email" | "url" | "regex";
  readonly args?: readonly unknown[];
}

/** What a control shows, never what is valid (that is `validation`). */
export interface SchemaFieldProps {
  readonly placeholder?: string;
  readonly hint?: string;
  /** A resource field: the kinds the picker lists (`"image/*"`), passed to the app's `list(query)`. */
  readonly accept?: string;
  /** A `textarea`'s rows. */
  readonly rows?: number;
  /** A `rich_text` field: show the video embed button. */
  readonly video?: boolean;
  /** A `collection` field: the label of its add button. */
  readonly addLabel?: string;
}

export interface SchemaField {
  readonly key: string;
  readonly kind: FieldKind;
  readonly label: string;
  readonly required?: boolean;
  /** Text kinds only: the value is `Record<locale, string>`. */
  readonly translatable?: boolean;
  readonly props?: SchemaFieldProps;
  /** `select` and `multi_select`. */
  readonly options?: readonly SelectChoice[];
  /** Whitelisted rules besides `required`: `min`/`max` (a text's length, a number's value, a list's size), `email`, `url`, `regex`. */
  readonly validation?: readonly FieldRule[];
  readonly visible_when?: VisibilityRule;
  /** `collection` only: the fields of each row. */
  readonly children?: readonly SchemaField[];
}

export interface FormSchema {
  readonly fields: readonly SchemaField[];
}
