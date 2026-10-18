import type { PreferencesPatch } from "../platform";

const isBag = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The ids stored at `path` of the preferences (`["onboarding", "tips_dismissed"]`); none when it is not a list of texts. */
export function storedIds(preferences: object, path: readonly string[]): readonly string[] {
  const found = path.reduce<unknown>((at, key) => (isBag(at) ? at[key] : undefined), preferences);
  return Array.isArray(found) ? found.filter((id): id is string => typeof id === "string") : [];
}

/** The patch that stores `ids` at `path`: `["a", "b"]` and `[x]` give `{ a: { b: [x] } }`. */
export function idsPatch(path: readonly string[], ids: readonly string[]): PreferencesPatch<Record<string, unknown>> {
  return path.reduceRight<unknown>((inner, key) => ({ [key]: inner }), ids) as PreferencesPatch<Record<string, unknown>>;
}
