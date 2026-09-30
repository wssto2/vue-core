/** A stretch of text, and whether the search matched it. */
export interface HighlightPart {
  readonly text: string;
  readonly match: boolean;
}

/**
 * Splits `text` around the words of `search` (whitespace-separated, case-insensitive, as the list's search
 * box reads them; accents are not folded). No search, or no match, is one unmatched part.
 */
export function highlightParts(text: string, search: string | null | undefined): readonly HighlightPart[] {
  const words = (search ?? "").split(/\s+/).filter((word) => word !== "");
  if (words.length === 0 || text === "") return [{ text, match: false }];

  // Longest first, so "ann" wins over "an" at the same place.
  const pattern = new RegExp(`(${words.sort((a, b) => b.length - a.length).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "giu");
  // With one capture group, `split` alternates: unmatched, matched, unmatched, …
  return text.split(pattern).flatMap((part, index) => (part === "" ? [] : [{ text: part, match: index % 2 === 1 }]));
}
