import type { HttpClient } from "../client";
import type { ViewResponse } from "../modules/savedview/entities";
import { savedviewRoutes } from "../modules/savedview/routes";

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
 * The seam to wherever an application keeps a person's saved views (`serverSavedViews` is the one for
 * go-core's `savedview` module). The application supplies one per list (`useCollection(def, { savedViews })`); the library
 * only reads, saves and removes through it. A saved view belongs to the signed-in person: the
 * adapter's backend decides who that is, the library clears what it loaded when the session changes.
 */
export interface SavedViews {
  list(listId: string, options: { signal: AbortSignal }): Promise<readonly SavedView[]>;
  /** Saving under a name already used replaces that view. */
  save(listId: string, name: string, state: SavedViewState): Promise<SavedView>;
  remove(listId: string, id: SavedView["id"]): Promise<void>;
}

const toView = ({ id, name, state }: ViewResponse): SavedView => ({ id, name, state: state as unknown as SavedViewState });

/**
 * `SavedViews` over go-core's `savedview` module (`GET | POST /v1/saved-views`, `DELETE /v1/saved-views/:id`): the
 * signed-in person's views, kept per list id. Make it in `setup` over the platform's client and pass it to
 * `useCollection(def, { savedViews: serverSavedViews(usePlatform().http) })`; a list that passes none has no saved views.
 *
 * The state travels as the library wrote it, `version` included: a view saved without one comes back without one
 * and is skipped by `useCollection` like any view of another `stateVersion`.
 */
export function serverSavedViews(http: HttpClient): SavedViews {
  return {
    async list(listId, { signal }) {
      return (await http.request(savedviewRoutes.index, { list: listId }, { signal })).data.map(toView);
    },
    async save(listId, name, state) {
      // A list without views hands over `view: null`; it is left out of what is stored.
      const stored = JSON.stringify({ ...state, view: state.view || undefined });
      return toView((await http.request(savedviewRoutes.store, { list_key: listId, name, state: stored })).data);
    },
    async remove(_listId, id) {
      await http.request(savedviewRoutes.delete, { id: Number(id) });
    },
  };
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
