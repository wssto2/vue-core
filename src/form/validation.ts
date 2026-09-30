/**
 * What a form needs of a validation library: Zod's `safeParse` shape, written out so the library
 * does not depend on Zod (Zod 3 and 4, Valibot's `safeParse` adapters and a hand-written object all fit).
 * The app's schema stays the one source of validation; the form only runs it and places the issues.
 */
export interface ValidationIssue {
  /** Where the problem is: a field name, then indexes or keys for nested values (`["items", 0, "quantity"]`). Empty: the form as a whole. */
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

export type ValidationResult<Output> =
  | { readonly success: true; readonly data: Output }
  | { readonly success: false; readonly error: { readonly issues: readonly ValidationIssue[] } };

export interface FormValidator<Output> {
  safeParse(input: unknown): ValidationResult<Output>;
}

/** Messages per field. A nested field is addressed by its dotted path (`items.0.quantity`); `""` is the form as a whole. */
export type FieldMessages = Readonly<Record<string, readonly string[]>>;

/** The issues of a validation as messages per dotted path. */
export function issuesToMessages(issues: readonly ValidationIssue[]): FieldMessages {
  const messages: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".");
    (messages[key] ??= []).push(issue.message);
  }
  return messages;
}

/** The field a dotted path belongs to: `items.0.quantity` belongs to `items`. */
export const fieldOfPath = (path: string): string => path.split(".")[0] ?? path;
