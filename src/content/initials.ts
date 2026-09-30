/**
 * Initials of a person's name: the first letters of the first and last word, upper-cased in the
 * name's own locale rules; "?" for no name.
 */
export function initialsFor(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0]?.[0], words.at(-1)?.[0]] : [words[0]?.[0]];

  return letters.filter(Boolean).join("").toLocaleUpperCase() || "?";
}
