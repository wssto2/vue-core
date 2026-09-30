import type { Formatting } from "../format";

export interface NumberMarks {
  /** What separates the integer and the fraction in the active locale ("," or "."). */
  readonly decimal: string;
  /** What separates thousands ("." "," or a space); "" when the locale has none. */
  readonly group: string;
}

/** The separators the app's formatting writes numbers with (an app's own formatter is honoured). */
export function numberMarks(format: Pick<Formatting, "number">): NumberMarks {
  const sample = format.number(1234.5, { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: true });
  const group = /^\d(\D)\d/.exec(sample)?.[1] ?? "";
  return { decimal: sample.charAt(sample.length - 2) || ".", group: group === "." || group === "," ? group : "" };
}

/**
 * Reads typed text as a number: null for empty, NaN-free. Both "." and "," are accepted as the decimal mark,
 * and either may group thousands: with both present the last one is the decimal mark; a single mark that
 * is the locale's grouping mark followed by exactly three digits groups ("1.000" is a thousand in hr);
 * repeated marks group; any other single mark is the decimal mark. With no decimals allowed, marks only group.
 * The result is rounded to `decimals`. Returns undefined for text that is not (yet) a number ("-", "1,,").
 */
export function parseNumber(text: string, options: { decimals: number; group: string }): number | null | undefined {
  const negative = text.trim().startsWith("-");
  const body = text.replace(/[^\d.,]/g, "");
  if (body === "") return negative ? undefined : null;
  const marks = [...body].filter((char) => char === "." || char === ",");
  let integer = body;
  let fraction = "";
  if (options.decimals > 0 && marks.length > 0) {
    const lastMark = Math.max(body.lastIndexOf("."), body.lastIndexOf(","));
    const mark = body.charAt(lastMark);
    const after = body.slice(lastMark + 1);
    const both = body.includes(".") && body.includes(",");
    const repeated = marks.filter((each) => each === mark).length > 1;
    const grouping = !both && mark === options.group && after.length === 3;
    if (both || (!repeated && !grouping)) {
      integer = body.slice(0, lastMark);
      fraction = after;
    }
  }
  const digits = (value: string) => value.replace(/\D/g, "");
  const parsed = Number(`${digits(integer) || "0"}.${digits(fraction) || "0"}`);
  if (!Number.isFinite(parsed)) return undefined;
  const rounded = Number(parsed.toFixed(options.decimals));
  return negative ? -rounded || 0 : rounded;
}
