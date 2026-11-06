import type * as Zod from "zod";
import { dateTimeValue, dateValue } from "../date/value";
import type { FormValidator, ValidationIssue } from "../validation";
import type { FieldRule, SchemaField, FormSchema } from "./schema";
import { evaluateVisibility, isEmptyValue } from "./visibility";

export interface SchemaValidatorOptions {
  /**
   * The `zod` module (`import * as zod from "zod"`). Passed in, not imported here, so an application that never validates a
   * schema does not need Zod installed: it is an optional peer, and an import in this file would load it with `@wssto2/vue-core/form`.
   */
  zod: typeof Zod;
  /**
   * Texts that replace Zod's. Without them the issues carry Zod's own messages, which `zodErrorMap(application)` words in the
   * application's language (a missing value reads as `validation_errors.required`).
   */
  messages?: Partial<Record<"required" | "email" | "url" | "regex" | "type", string>>;
  /** The language a required translatable text needs. Default: any language written. */
  defaultLocale?: string;
}

const numberArg = (rule: FieldRule): number => {
  const [value] = rule.args ?? [];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`buildValidator: the "${rule.rule}" rule needs a number argument.`);
  return value;
};

const isId = (value: unknown): value is string | number => typeof value === "string" || typeof value === "number";

/**
 * A validator for a schema, with the shape `useForm` takes (`safeParse`), built on Zod 4. It checks what the server will: `required`,
 * the type of each kind, `min` / `max` (a text's length, a number's value, the size of a list or collection), `email`, `url`,
 * `regex`, and the rows of a collection. A field whose `visible_when` does not hold is skipped, and left out of the output, as is a
 * key the schema does not list. The server is authoritative; this only saves the round trip.
 *
 *   const validator = buildValidator(schema, { zod });
 *   const form = useForm({ defaults, validator });
 *
 * A `regex` argument must be valid for both JavaScript and Go's RE2 (no look-around, no back-references). A rule the schema
 * words wrongly (`max` without a number) throws when the validator is built, not on the user's first keystroke.
 */
export function buildValidator(schema: FormSchema, options: SchemaValidatorOptions): FormValidator<Record<string, unknown>> {
  const z = options.zod;
  const { messages = {} } = options;
  const required = z.any().refine(() => false, { params: { code: "required" }, ...(messages.required !== undefined ? { error: messages.required } : {}) });
  const typed = (error?: string) => (error !== undefined ? { error } : {});

  // The checks of a value that is not empty: the type, then the rules.
  function checks(field: SchemaField): Zod.ZodType[] {
    const rules = field.validation ?? [];
    const rule = (name: FieldRule["rule"]) => rules.find((each) => each.rule === name);
    const min = rule("min");
    const max = rule("max");
    const text = (): Zod.ZodType[] => {
      let base = z.string(typed(messages.type));
      if (min) base = base.min(numberArg(min));
      if (max) base = base.max(numberArg(max));
      const found: Zod.ZodType[] = [base];
      if (rule("email")) found.push(z.email(typed(messages.email)));
      if (rule("url")) found.push(z.url(typed(messages.url)));
      const pattern = rule("regex")?.args?.[0];
      if (typeof pattern === "string") found.push(z.string().regex(new RegExp(pattern), typed(messages.regex)));
      else if (rule("regex")) throw new Error(`buildValidator: the "regex" rule of "${field.key}" needs a pattern string.`);
      return found;
    };
    const list = (item: Zod.ZodType): Zod.ZodType => {
      let base = z.array(item);
      if (min) base = base.min(numberArg(min));
      if (max) base = base.max(numberArg(max));
      return base;
    };
    switch (field.kind) {
      case "text":
      case "textarea":
      case "rich_text":
        // A translated text: every language written is checked as the text it is.
        return field.translatable ? [z.record(z.string(), z.unknown()).superRefine((record, ctx) => {
          for (const [locale, value] of Object.entries(record)) {
            if (isEmptyValue(value)) continue;
            for (const check of text()) for (const issue of check.safeParse(value).error?.issues ?? []) ctx.addIssue({ ...issue, path: [locale, ...issue.path] } as Zod.core.$ZodRawIssue);
          }
        })] : text();
      case "number": {
        let base = z.number(typed(messages.type));
        if (min) base = base.min(numberArg(min));
        if (max) base = base.max(numberArg(max));
        return [base];
      }
      case "boolean":
        return [z.boolean(typed(messages.type))];
      case "select": {
        const values = (field.options ?? []).map((option) => option.value);
        return [z.union([z.string(), z.number()], typed(messages.type)).refine((value) => values.includes(value), { params: { code: "invalid_choice" } })];
      }
      case "multi_select": {
        const values = (field.options ?? []).map((option) => option.value);
        return [list(z.union([z.string(), z.number()])), z.array(z.unknown()).refine((items) => items.every((item) => values.includes(item as string | number)), { params: { code: "invalid_choice" } })];
      }
      case "date":
        return [z.string(typed(messages.type)).refine((value) => dateValue(value) !== null, { params: { code: "date" } })];
      case "datetime":
        return [z.string(typed(messages.type)).refine((value) => dateTimeValue(value) !== null, { params: { code: "datetime" } })];
      case "image":
      case "document":
        return [z.custom<string | number>(isId, typed(messages.type))];
      case "gallery":
        return [list(z.custom<string | number>(isId))];
      case "collection":
        return [list(z.record(z.string(), z.unknown()))];
    }
  }

  const compiled = new Map<SchemaField, Zod.ZodType[]>();
  const compile = (fields: readonly SchemaField[]) => {
    for (const field of fields) {
      compiled.set(field, checks(field));
      if (field.children) compile(field.children);
    }
  };
  compile(schema.fields);

  // A required boolean needs an answer, not a `true`; every other kind needs something written or chosen.
  const missing = (field: SchemaField, value: unknown) => (field.kind === "boolean" ? value === null || value === undefined : isEmptyValue(value));
  const isRequired = (field: SchemaField) => field.required === true || field.validation?.some((rule) => rule.rule === "required") === true;
  // A required translatable text needs the default language when the validator knows it, else any.
  const missingText = (field: SchemaField, value: unknown) => {
    if (!field.translatable || typeof value !== "object" || value === null) return missing(field, value);
    const record = value as Record<string, unknown>;
    return options.defaultLocale !== undefined ? isEmptyValue(record[options.defaultLocale]) : isEmptyValue(record);
  };

  function run(fields: readonly SchemaField[], values: Readonly<Record<string, unknown>>, path: readonly PropertyKey[], issues: ValidationIssue[]): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const field of fields) {
      if (!evaluateVisibility(field.visible_when, values)) continue;
      const value = values[field.key];
      const at = [...path, field.key];
      data[field.key] = value;
      const absent = field.kind === "text" || field.kind === "textarea" || field.kind === "rich_text" ? missingText(field, value) : missing(field, value);
      if (absent) {
        if (isRequired(field)) for (const issue of required.safeParse(value).error?.issues ?? []) issues.push({ path: at, message: issue.message });
        continue;
      }
      for (const check of compiled.get(field) ?? []) {
        for (const issue of check.safeParse(value).error?.issues ?? []) {
          issues.push({ path: [...at, ...issue.path], message: issue.message });
        }
      }
      if (field.kind === "collection" && field.children && Array.isArray(value) && value.every((row) => typeof row === "object" && row !== null)) {
        data[field.key] = (value as Record<string, unknown>[]).map((row, index) => run(field.children!, row, [...at, index], issues));
      }
    }
    return data;
  }

  return {
    safeParse(input: unknown) {
      const values = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
      const issues: ValidationIssue[] = [];
      const data = run(schema.fields, values, [], issues);
      return issues.length > 0 ? { success: false, error: { issues } } : { success: true, data };
    },
  };
}
