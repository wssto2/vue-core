/** The `params.code` of the issue `refineStorableText` adds, and the code the server answers with (422). */
export const unsupportedCharactersCode = "unsupported_characters";

/**
 * Characters outside the Basic Multilingual Plane (4 bytes in UTF-8: emoji and other
 * supplementary-plane symbols). A utf8mb3 column cannot store them, so a server on such a
 * database refuses them as `unsupported_characters`; a form flags them first. A lone
 * surrogate is not one of them, and Croatian letters are 2 bytes.
 */
const supplementary = /[\u{10000}-\u{10FFFF}]/u;

/** True when `value` holds a character a utf8mb3 column cannot store. */
export function hasUnsupportedCharacters(value: string): boolean {
  return supplementary.test(value);
}

/** What `refineStorableText` needs of the validator's context; Zod's `RefinementCtx` fits, the library does not import Zod. */
export interface StorableTextContext {
  addIssue(issue: { code: "custom"; path: (string | number)[]; params: { code: typeof unsupportedCharactersCode } }): void;
}

function walk(value: unknown, path: (string | number)[], ctx: StorableTextContext): void {
  if (typeof value === "string") {
    if (hasUnsupportedCharacters(value)) ctx.addIssue({ code: "custom", path, params: { code: unsupportedCharactersCode } });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, [...path, index], ctx));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) walk(item, [...path, key], ctx);
  }
}

/**
 * `.superRefine` callback: reports every string anywhere in the value that holds an unsupported
 * character, on that string's path, with `params.code` set to `unsupportedCharactersCode` (the
 * app's i18n owns the wording).
 *
 * ```ts
 * const schema = z.object({ name: z.string(), notes: z.array(z.string()) }).superRefine(refineStorableText);
 * ```
 */
export function refineStorableText(data: unknown, ctx: StorableTextContext): void {
  walk(data, [], ctx);
}
