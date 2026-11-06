import type { VisibilityCondition, VisibilityRule } from "./schema";

/** Empty means not entered: null, undefined, "", an empty list, and an object (a translated text) with no non-blank entry. `false` and `0` are values. */
export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).every(isEmptyValue);
  return false;
}

// JSON equality: primitives strictly (`1` is not `true`), lists and objects by content.
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => key in right && same(left[key], right[key]));
}

function holds(condition: VisibilityCondition, values: Readonly<Record<string, unknown>>): boolean | null {
  const value = values[condition.field];
  if ("eq" in condition) return same(value, condition.eq);
  if ("ne" in condition) return !same(value, condition.ne);
  if ("in" in condition) return Array.isArray(condition.in) ? condition.in.some((candidate) => same(value, candidate)) : null;
  if ("empty" in condition) return isEmptyValue(value);
  if ("not_empty" in condition) return !isEmptyValue(value);
  return null;
}

/**
 * Whether a field with this `visible_when` rule shows, given the form's values. A pure function; the server evaluates the same
 * rule (a hidden field is neither required nor validated) and both run `test-data/content/visibility.json`.
 *
 * - no rule, or a rule with no conditions: visible;
 * - `all`: every condition holds; `any`: at least one does;
 * - a malformed condition (unknown operator, `in` without a list) is skipped, and a rule left with none is visible: a broken rule never hides a field for good.
 */
export function evaluateVisibility(rule: VisibilityRule | null | undefined, values: Readonly<Record<string, unknown>>): boolean {
  if (!rule) return true;
  const verdicts = (rule.all ?? rule.any ?? []).map((condition) => holds(condition, values)).filter((verdict): verdict is boolean => verdict !== null);
  if (verdicts.length === 0) return true;
  return rule.all ? verdicts.every(Boolean) : verdicts.some(Boolean);
}
