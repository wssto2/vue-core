/**
 * What "Saved views" stores for a list: the filters, the search and the scope, stamped with the
 * definition's `stateVersion` so a view saved before the meaning of a key changed is migrated or
 * skipped rather than misapplied. Sort and paging are not part of a saved view.
 */
export interface SavedViewState {
  readonly version: number;
  readonly filters: Readonly<Record<string, string>>;
  readonly search: string;
  readonly view?: string | null;
}

export interface SavedView {
  readonly id: string | number;
  readonly name: string;
  readonly state: SavedViewState;
}

/**
 * The seam to wherever an application keeps a person's saved views (go-core has no endpoint for it
 * yet). The application supplies one per list (`useCollection(def, { savedViews })`); the library
 * only reads, saves and removes through it. A saved view belongs to the signed-in person: the
 * adapter's backend decides who that is, the library clears what it loaded when the session changes.
 */
export interface SavedViews {
  list(listId: string, options: { signal: AbortSignal }): Promise<readonly SavedView[]>;
  /** Saving under a name already used replaces that view. */
  save(listId: string, name: string, state: SavedViewState): Promise<SavedView>;
  remove(listId: string, id: SavedView["id"]): Promise<void>;
}

/** An in-memory `SavedViews` for tests and the playground. It forgets everything on reload; not for an application. */
export function createMemorySavedViews(initial: Readonly<Record<string, readonly SavedView[]>> = {}): SavedViews {
  const lists = new Map<string, SavedView[]>(Object.entries(initial).map(([id, views]) => [id, [...views]]));
  let next = 1;
  const of = (listId: string) => {
    let views = lists.get(listId);
    if (!views) lists.set(listId, (views = []));
    return views;
  };

  return {
    async list(listId) {
      return [...of(listId)];
    },
    async save(listId, name, state) {
      const views = of(listId);
      const existing = views.findIndex((view) => view.name === name);
      const saved: SavedView = { id: existing === -1 ? `view-${next++}` : views[existing]!.id, name, state };
      if (existing === -1) views.push(saved);
      else views[existing] = saved;
      return saved;
    },
    async remove(listId, id) {
      const views = of(listId);
      const index = views.findIndex((view) => view.id === id);
      if (index !== -1) views.splice(index, 1);
    },
  };
}
