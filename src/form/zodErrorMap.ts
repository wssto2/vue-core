import type { Formatting } from "../format";

/** What a Zod issue (`$ZodRawIssue`) is read for. Structural, so the library needs no Zod: the map is handed to `z.config({ customError })`. */
export interface ZodIssueLike {
  readonly code?: string;
  readonly origin?: string;
  readonly minimum?: number | bigint;
  readonly maximum?: number | bigint;
  readonly format?: string;
  readonly params?: Record<string, unknown>;
}

/** The parts of an application the map reads: its vue-i18n instance (`createApplication`'s `application`) and its formatting. */
export interface ZodErrorMapEnvironment {
  readonly i18n: { readonly global: { t(key: string, params?: Record<string, unknown>): string; te(key: string): boolean } };
  readonly format: Pick<Formatting, "number">;
}

// "9.999.999" rather than "9999999" in a message. Small whole numbers stay as written, so a year bound reads "2100", not "2.100".
const bound = (format: ZodErrorMapEnvironment["format"], value: number | bigint | undefined): string => {
  const n = Number(value);
  if (Number.isInteger(n) && Math.abs(n) < 10000) return String(n);
  const digits = Number.isInteger(n) ? 0 : 2;
  return format.number(n, { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

/**
 * A Zod error map onto the `validation_errors.*` texts, so a schema's own failures ("Required", "at least 3 characters", a bound,
 * an e-mail address) read in the active language and the application's wording. Zod 4's `customError`; register it once:
 *
 *   z.config({ customError: zodErrorMap(application) });
 *
 * Each text is looked up as the application's `validation_errors.<key>` first, then the library's `core.validation_errors.<key>`
 * (`required`, `min`, `max`, `min_value`, `max_value`, `email`, `url`, `date`, `datetime`), so an application overrides any of them
 * by defining the key. A `refine` or `superRefine` names its own text with `params: { code: "deadline_before_opening" }`, which reads
 * `validation_errors.deadline_before_opening` (`code: "required"` is the generated schemas' "zero is missing"). An issue it has no text
 * for returns `undefined`, so Zod's own sentence stands, and a message a schema carries itself is never asked for.
 */
export function zodErrorMap({ i18n, format }: ZodErrorMapEnvironment): (issue: ZodIssueLike) => { message: string } | undefined {
  const { t, te } = i18n.global;
  const own = (key: string) => `validation_errors.${key}`;
  const core = (key: string) => `core.validation_errors.${key}`;
  // A built-in: the application's text when it has one, else the library's (which exists in every shipped language).
  const text = (key: string, params?: Record<string, unknown>) => ({ message: t(te(own(key)) ? own(key) : core(key), params) });

  return (issue) => {
    switch (issue.code) {
      case "invalid_type":
        return text("required");

      case "too_small":
        if (issue.origin === "string") return Number(issue.minimum) === 1 ? text("required") : text("min", { min: Number(issue.minimum) });
        if (issue.origin === "number") return text("min_value", { min: bound(format, issue.minimum) });
        return undefined;

      case "too_big":
        if (issue.origin === "string") return text("max", { max: Number(issue.maximum) });
        if (issue.origin === "number") return text("max_value", { max: bound(format, issue.maximum) });
        return undefined;

      case "invalid_format":
        return issue.format !== undefined && ["email", "url", "date", "datetime"].includes(issue.format) ? text(issue.format) : undefined;

      case "custom": {
        const code = issue.params?.code;
        if (typeof code !== "string") return undefined;
        if (code === "required") return text("required");
        const key = te(own(code)) ? own(code) : te(core(code)) ? core(code) : null;
        return key === null ? undefined : { message: t(key) };
      }

      default:
        return undefined;
    }
  };
}
