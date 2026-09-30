/**
 * The state of anything loaded asynchronously, as a union so a slot receives the value non-null
 * and impossible combinations (loading and failed, loaded without a value) cannot be written.
 *
 * - `loading`: nothing to show yet.
 * - `loaded`: the value.
 * - `refreshing`: a reload is running; the previous value stays on screen.
 * - `stale`: the previous value stays on screen but may be out of date, because the reload
 *   failed (`error`) or was not possible.
 * - `failed`: nothing to show, and why.
 */
export type AsyncState<Value> =
  | { status: "loading" }
  | { status: "loaded"; value: Value }
  | { status: "refreshing"; value: Value }
  | { status: "stale"; value: Value; error?: string }
  | { status: "failed"; error: string };

/** The value of a state that has one. */
export function valueOf<Value>(state: AsyncState<Value>): Value | undefined {
  return state.status === "loading" || state.status === "failed" ? undefined : state.value;
}

/** Nothing to list: null or undefined, an empty array, an empty string. */
export function isEmptyValue(value: unknown): boolean {
  return value == null || value === "" || (Array.isArray(value) && value.length === 0);
}
