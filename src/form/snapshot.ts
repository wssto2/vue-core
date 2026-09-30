import { toRaw } from "vue";

/** A copy of a form value that shares nothing with the original: nested arrays and objects are copied, dates too; files stay the same file. */
export function cloneValue<T>(value: T): T {
  const raw = toRaw(value) as unknown;
  if (raw === null || typeof raw !== "object") return raw as T;
  if (raw instanceof Date) return new Date(raw.getTime()) as T;
  if (typeof Blob !== "undefined" && raw instanceof Blob) return raw as T;
  if (Array.isArray(raw)) return raw.map(cloneValue) as T;
  return Object.fromEntries(Object.entries(raw).map(([key, entry]) => [key, cloneValue(entry)])) as T;
}

/** Whether two form values hold the same data: dates by time, lists and objects by content, `undefined` like an absent key, `NaN` like itself. */
export function sameValue(a: unknown, b: unknown): boolean {
  // Read through the reactive proxies (no `toRaw`), so a computed comparing a draft tracks every value it read.
  const left = a;
  const right = b;
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  if (left instanceof Date || right instanceof Date) return left instanceof Date && right instanceof Date && left.getTime() === right.getTime();
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((entry, index) => sameValue(entry, right[index]));
  }
  if (typeof Blob !== "undefined" && (left instanceof Blob || right instanceof Blob)) return false; // not the same object: a different file
  const keys = (object: object) => Object.keys(object).filter((key) => (object as Record<string, unknown>)[key] !== undefined);
  const leftKeys = keys(left);
  return (
    leftKeys.length === keys(right).length &&
    leftKeys.every((key) => sameValue((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]))
  );
}
