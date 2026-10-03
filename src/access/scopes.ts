import type { ScopeOption, ScopeOptions } from "../modules/access/entities";

/** A way to say where a role applies: a level of the hierarchy, and the chain of places down to it (a dealer, then its location). */
export interface ScopeLevel {
  readonly level: string;
  /** The levels from just below the root down to this one; empty for the root itself. */
  readonly chain: readonly string[];
}

/**
 * The levels a person may be given roles at, from what the server says (`GET /v1/iam/users/:id/scopes`): each level that has places,
 * narrowest first, then the root when roles may be given there. The hierarchy is read off the places (each says its parent level), so
 * the library knows no level names.
 */
export function scopeLevels(options: ScopeOptions): readonly ScopeLevel[] {
  const parentOf = new Map<string, string>();
  for (const place of options.places) parentOf.set(place.level, place.parent_level);
  const chainOf = (level: string): string[] => {
    const chain = [level];
    const seen = new Set(chain);
    for (let parent = parentOf.get(level); parent !== undefined && parent !== options.root_level && parentOf.has(parent) && !seen.has(parent); parent = parentOf.get(parent)) {
      chain.unshift(parent);
      seen.add(parent);
    }
    return chain;
  };
  const levels = [...parentOf.keys()].map((level): ScopeLevel => ({ level, chain: chainOf(level) })).sort((a, b) => b.chain.length - a.chain.length || a.level.localeCompare(b.level));
  return options.root ? [...levels, { level: options.root_level, chain: [] }] : levels;
}

/** Where to start: the broadest level below the root (the usual choice), else the root. */
export const defaultLevel = (levels: readonly ScopeLevel[]): ScopeLevel | null =>
  levels.filter((entry) => entry.chain.length > 0).sort((a, b) => a.chain.length - b.chain.length)[0] ?? levels[0] ?? null;

/**
 * The places to choose from at step `index` of `level`'s chain, given what was chosen above (`chosen[i]` is the id at `chain[i]`). A place
 * that has nothing below it in the chain is left out when the level is deeper: it could not complete a choice.
 */
export function placesAt(options: ScopeOptions, level: ScopeLevel, index: number, chosen: readonly (number | null)[]): readonly ScopeOption[] {
  const here = level.chain[index];
  const next = level.chain[index + 1];
  return options.places.filter(
    (place) =>
      place.level === here &&
      (index === 0 || (place.parent_level === level.chain[index - 1] && place.parent_id === chosen[index - 1])) &&
      (next === undefined || options.places.some((below) => below.level === next && below.parent_id === place.id)),
  );
}
