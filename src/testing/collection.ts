import type { CollectionQuery, ListPage, LoadContext } from "../collection";

/** One page of a list as a loader returns it: the rows and the counts a pager shows, from the rows alone (`overrides` for a page of many). */
export function listPage<Row>(rows: readonly Row[], overrides: Partial<ListPage<Row>> = {}): ListPage<Row> {
  return {
    rows,
    total: rows.length,
    page: 1,
    pageSize: 25,
    lastPage: rows.length === 0 ? 0 : 1,
    from: rows.length === 0 ? 0 : 1,
    to: rows.length,
    ...overrides,
  };
}

/**
 * A collection loader that records every call (the query it was asked, the signal it was given) and
 * answers from a function of the query, so a test can assert what a list asked the backend for.
 *
 *   const { load, calls } = fakeLoader((query) => listPage(tickets));
 *   const list = defineCollection({ id: "tickets", stateVersion: 1, load, key: (ticket) => ticket.id, query: { sorts: [], filters: [] } });
 *   expect(calls[0]?.query.page).toBe(1);
 */
export function fakeLoader<Row>(answer: (query: CollectionQuery, context: LoadContext, call: number) => Promise<ListPage<Row>> | ListPage<Row>) {
  const calls: { query: CollectionQuery; signal: AbortSignal }[] = [];
  const load = (query: CollectionQuery, context: LoadContext) => {
    calls.push({ query, signal: context.signal });
    return Promise.resolve(answer(query, context, calls.length));
  };
  return { load, calls };
}
