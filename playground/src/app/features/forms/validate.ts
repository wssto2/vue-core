import type { FormValidator } from "@wssto2/vue-core/form";

/** A check of one value: the message when it is wrong, else null. */
export type Check<Value> = (value: Value) => string | null;

/**
 * The playground's schema: one check per field, nested checks by dotted path through `lines`. Real apps bring their own (Zod, Valibot):
 * the library only asks for the `safeParse` shape.
 */
export function validator<Values extends object>(checks: { readonly [Key in keyof Values]?: Check<Values[Key]> }, whole?: (values: Values) => { path: (string | number)[]; message: string }[]): FormValidator<Values> {
  return {
    safeParse(input) {
      const values = input as Values;
      const issues: { path: (string | number)[]; message: string }[] = [];
      for (const key of Object.keys(checks) as (keyof Values & string)[]) {
        const message = (checks[key] as Check<Values[typeof key]> | undefined)?.(values[key]);
        if (message) issues.push({ path: [key], message });
      }
      issues.push(...(whole?.(values) ?? []));
      return issues.length > 0 ? { success: false, error: { issues } } : { success: true, data: values };
    },
  };
}

export const required =
  (message: string): Check<string> =>
  (value) =>
    value.trim() === "" ? message : null;

export const email =
  (message: string): Check<string> =>
  (value) =>
    value === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? null : message;

/** `tax_id` to `taxId`, segment by segment (`lines.0.unit_price` to `lines.0.unitPrice`). */
export const camel = (field: string): string => field.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
