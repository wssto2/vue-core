import { describe, expect, it } from "vitest";
import { defineCollection } from "./definition";
import { decodeState } from "./state";
import { fakeLoader, flush, inApp, makeRouter, page, type Row } from "./testing";
import { useCollection } from "./useCollection";

// Nothing exists at "split"; the other location has a row. Whatever narrows further answers nothing.
function setup() {
  const loader = fakeLoader((query) => page(query.filters.location === "split" || query.search !== "" || query.filters.status ? [] : [{ id: 1, title: "Ticket 1" } satisfies Row]));
  const definition = defineCollection({
    id: "tickets",
    stateVersion: 1,
    load: loader.load,
    key: (row: Row) => row.id,
    query: { sorts: ["created_at", "title"], filters: ["location", "status"], views: ["mine", "all"] },
    defaults: { sort: "created_at", direction: "desc" },
  });
  return { definition, ...loader };
}

const memory = { kind: "memory" } as const;
const url = { kind: "url", key: "query" } as const;
const start = { filters: { location: "split" } };

describe("a list's starting values", () => {
  it("opens on them, sends them like any filter and shows the empty state, not no-matches", async () => {
    const { definition, calls } = setup();
    const list = useCollection(definition, { state: memory, defaults: start });
    await flush();
    expect(calls[0]!.query.filters).toEqual({ location: "split" });
    expect(list.rows.value).toEqual([]);
    expect(list.isFiltered.value).toBe(false);
    expect(list.display.value).toBe("empty");
  });

  it("counts a changed filter or a search as narrowing: no-matches", async () => {
    const { definition } = setup();
    const list = useCollection(definition, { state: memory, defaults: start });
    await flush();
    list.setFilter("status", "open");
    await flush();
    expect(list.display.value).toBe("no-matches");
    list.setFilter("status", null);
    list.search("golf");
    await flush();
    expect(list.display.value).toBe("no-matches");
    list.search("");
    list.setFilter("location", "zadar"); // another value is a choice the user made
    await flush();
    expect(list.isFiltered.value).toBe(true);
  });

  it("clearing the start shows everything and does not read as a search", async () => {
    const { definition, calls } = setup();
    const list = useCollection(definition, { state: memory, defaults: start });
    await flush();
    list.setFilter("location", null);
    await flush();
    expect(calls.at(-1)!.query.filters).toEqual({});
    expect(list.isFiltered.value).toBe(false);
    expect(list.display.value).toBe("rows");
  });

  it("reset() returns to the start, not past it", async () => {
    const { definition, calls } = setup();
    const list = useCollection(definition, { state: memory, defaults: { ...start, search: "ana", sort: "title", direction: "asc" } });
    await flush();
    list.setFilters({ location: null, status: "open" });
    list.search("");
    list.setPageSize(50);
    await flush();
    list.reset();
    await flush();
    expect(list.query.value).toMatchObject({ page: 1, pageSize: 25, sort: "title", direction: "asc", search: "ana", filters: { location: "split" } });
    expect(calls.at(-1)!.query.filters).toEqual({ location: "split" });
  });

  it("a view is never narrowing", async () => {
    const { definition } = setup();
    const list = useCollection(definition, { state: memory, defaults: { ...start, view: "mine" } });
    await flush();
    expect(list.query.value.view).toBe("mine");
    expect(list.isFiltered.value).toBe(false);
  });

  it("a list without them counts the definition's defaults as before", async () => {
    const { definition } = setup();
    const list = useCollection(definition, { state: memory });
    await flush();
    expect(list.isFiltered.value).toBe(false);
    list.setFilter("location", "split");
    expect(list.isFiltered.value).toBe(true);
  });

  it("is checked against the query contract", () => {
    const { definition } = setup();
    expect(() => useCollection(definition, { state: memory, defaults: { filters: { nope: "x" } as never } })).toThrow(/not in `query.filters`/);
    expect(() => useCollection(definition, { state: memory, defaults: { sort: "nope" as never } })).toThrow(/not in `query.sorts`/);
  });
});

describe("a list's starting values in the URL", () => {
  it("writes the state, which reads back to the same state with the start and, for a record link, without it", async () => {
    const router = await makeRouter();
    const { definition } = setup();
    const { result: list } = inApp(() => useCollection(definition, { state: url, defaults: start }), { router });
    await flush();
    expect(decodeState(definition, router.currentRoute.value.query.query)).toMatchObject({ filters: { location: "split" } });

    list.setFilter("location", null);
    await flush();
    const cleared = router.currentRoute.value.query.query;
    expect(decodeState(definition, cleared)).toMatchObject({ filters: {} });
    expect(decodeState(definition, list.linkContext().from)).toEqual(list.query.value);

    // A link that holds the cleared state beats the start; a URL without state starts from it.
    const second = await makeRouter(`/list?query=${cleared}`);
    const again = inApp(() => useCollection(definition, { state: url, defaults: start }), { router: second }).result;
    await flush();
    expect(again.query.value.filters).toEqual({});
    const third = await makeRouter("/list");
    const fresh = inApp(() => useCollection(definition, { state: url, defaults: start }), { router: third }).result;
    await flush();
    expect(fresh.query.value.filters).toEqual({ location: "split" });
  });

  it("a cleared start search and view survive a round trip", async () => {
    const router = await makeRouter();
    const { definition } = setup();
    const options = { state: url, defaults: { search: "ana", view: "mine" } } as const;
    const { result: list } = inApp(() => useCollection(definition, options), { router });
    await flush();
    list.search("");
    list.setView(null);
    await flush();
    const written = router.currentRoute.value.query.query;
    expect(decodeState(definition, written)).toMatchObject({ search: "", view: null });
    const again = inApp(() => useCollection(definition, options), { router: await makeRouter(`/list?query=${written}`) }).result;
    await flush();
    expect(again.query.value).toMatchObject({ search: "", view: null });
  });

  it("the link's `any` still clears a starting filter", async () => {
    const router = await makeRouter("/list?where=any");
    const { definition, calls } = setup();
    const { result: list } = inApp(() => useCollection(definition, { state: url, defaults: start, linked: { params: { where: "location" } } }), { router });
    await flush();
    expect(list.query.value.filters).toEqual({});
    expect(calls[0]!.query.filters).toEqual({});
    expect(router.currentRoute.value.query.where).toBeUndefined();
    expect(list.display.value).toBe("rows");
  });

  it("a plain link parameter replaces the start's value", async () => {
    const router = await makeRouter("/list?where=zadar");
    const { definition } = setup();
    const { result: list } = inApp(() => useCollection(definition, { state: url, defaults: start, linked: { params: { where: "location" } } }), { router });
    await flush();
    expect(list.query.value.filters).toEqual({ location: "zadar" });
  });
});
