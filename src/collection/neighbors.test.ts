import { describe, expect, it } from "vitest";
import { useRoute } from "vue-router";
import { createPlatform, parseBootstrap } from "../platform";
import { snapshotOf } from "../platform/testing";
import { defineCollection } from "./definition";
import { useCollectionNeighbors } from "./neighbors";
import { encodeState } from "./state";
import { fakeLoader, flush, inApp, makeRouter, page, type Row } from "./testing";
import type { CollectionQuery } from "./types";

const ALL: Row[] = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, title: `Ticket ${index + 1}` }));

function setup(options: { failPage?: () => number | null } = {}) {
  const loader = fakeLoader((query) => {
    if (options.failPage?.() === query.page) throw new Error("offline");
    const matching = ALL.filter((row) => !query.search || row.title.includes(query.search));
    const from = (query.page - 1) * query.pageSize;
    return page(matching.slice(from, from + query.pageSize), { page: query.page, pageSize: query.pageSize, total: matching.length, lastPage: Math.ceil(matching.length / query.pageSize) });
  });
  const definition = defineCollection({
    id: "tickets",
    stateVersion: 1,
    load: loader.load,
    key: (row: Row) => row.id,
    query: { sorts: ["title"], filters: ["status"], views: ["mine"] },
    defaults: { pageSize: 5, sort: "title" },
  });
  return { definition, ...loader };
}

const stateOf = (definition: ReturnType<typeof setup>["definition"], patch: Partial<CollectionQuery<"title", "status", "mine">> = {}) => encodeState(definition, { ...definition.defaults, ...patch } as CollectionQuery<"title", "status", "mine">);

async function open(definition: ReturnType<typeof setup>["definition"], id: number, from: string | null, platform?: Parameters<typeof inApp>[1] extends infer O ? (O extends { platform?: infer P } ? P : never) : never) {
  const router = await makeRouter(`/records/${id}${from === null ? "" : `?from=${from}`}`);
  const { result } = inApp(
    () => {
      const route = useRoute();
      return useCollectionNeighbors(definition, { current: () => route.params.recordID as string, list: { name: "list" }, param: "recordID", backLabel: "Tickets" });
    },
    { router, platform },
  );
  await flush();
  return { neighbors: result, router };
}

describe("useCollectionNeighbors", () => {
  it("replays the list's exact query (search, view, sort) through the same loader", async () => {
    const { definition, calls } = setup();
    const from = stateOf(definition, { page: 1, search: "Ticket 1", view: "mine", sort: "title", direction: "desc", filters: { status: "open" } });
    const { neighbors } = await open(definition, 1, from);
    expect(calls[0]!.query).toEqual({ page: 1, pageSize: 5, sort: "title", direction: "desc", search: "Ticket 1", view: "mine", filters: { status: "open" } });
    expect(neighbors.position.value).toBe(1);
    expect(neighbors.total.value).toBe(4); // Ticket 1, 10, 11, 12
    expect(neighbors.next.value?.key).toBe(10);
  });

  it("steps across page boundaries and back to the list on the record's own page", async () => {
    const { definition } = setup();
    const from = stateOf(definition, { page: 2 });

    const first = (await open(definition, 6, from)).neighbors;
    expect(first.position.value).toBe(6);
    expect(first.total.value).toBe(12);
    expect(first.previous.value?.key).toBe(5);
    expect(first.next.value?.key).toBe(7);
    expect(first.previous.value?.to).toMatchObject({ name: "record", params: { recordID: "5" } });
    expect(first.previous.value?.to).toMatchObject({ query: { from: stateOf(definition, { page: 1 }) } });
    expect(first.listRoute.value).toMatchObject({ name: "list", query: { query: stateOf(definition, { page: 2 }) } });

    const last = (await open(definition, 10, stateOf(definition, { page: 2 }))).neighbors;
    expect(last.next.value?.key).toBe(11);
    const edge = (await open(definition, 12, stateOf(definition, { page: 3 }))).neighbors;
    expect(edge.next.value).toBeNull();
    expect(edge.previous.value?.key).toBe(11);
    const start = (await open(definition, 1, stateOf(definition, { page: 1 }))).neighbors;
    expect(start.previous.value).toBeNull();
    const middle = (await open(definition, 5, stateOf(definition, { page: 1 }))).neighbors;
    expect(middle.next.value).toMatchObject({ key: 6, to: { query: { from: stateOf(definition, { page: 2 }) } } });
  });

  it("links the neighbors to where the page is now, after it moves within the record (another section)", async () => {
    const { definition } = setup();
    const from = stateOf(definition, { page: 2 });
    const { neighbors, router } = await open(definition, 6, from);
    await router.push({ name: "record", params: { recordID: "6" }, query: { from, tab: "history" }, hash: "#notes" });
    await flush();
    expect(neighbors.next.value?.to).toMatchObject({ params: { recordID: "7" }, query: { from, tab: "history" }, hash: "#notes" });
  });

  it("supplies the record page's list context: back with the list's state, the pager from the neighbors", async () => {
    const { definition } = setup();
    const { neighbors } = await open(definition, 6, stateOf(definition, { page: 2 }));

    expect(neighbors.context.back).toMatchObject({ label: "Tickets", to: { name: "list", query: { query: stateOf(definition, { page: 2 }) } } });
    expect(neighbors.context.neighbors).toMatchObject({ position: 6, total: 12, previous: { params: { recordID: "5" } }, next: { params: { recordID: "7" } } });

    const edge = (await open(definition, 12, stateOf(definition, { page: 3 }))).neighbors;
    expect(edge.context.neighbors).toMatchObject({ position: 12, next: null });
  });

  it("has a list context for a direct link too: back to the plain list, no pager", async () => {
    const { definition } = setup();
    const { neighbors } = await open(definition, 3, null);
    expect(neighbors.context.back).toEqual({ label: "Tickets", to: { name: "list" } });
    expect(neighbors.context.neighbors).toBeNull();
  });

  it("finds a record that slipped to the neighboring page", async () => {
    const { definition } = setup();
    const { neighbors } = await open(definition, 7, stateOf(definition, { page: 1 }));
    expect(neighbors.position.value).toBe(7);
    expect(neighbors.previous.value?.key).toBe(6);
  });

  it("asks for nothing without list state or with state it cannot trust", async () => {
    const { definition, calls } = setup();
    for (const from of [null, "garbage", btoa(JSON.stringify({ v: 7, p: 1 }))]) {
      const { neighbors } = await open(definition, 3, from);
      expect(neighbors.position.value).toBeNull();
      expect(neighbors.previous.value).toBeNull();
      expect(neighbors.listRoute.value).toBeNull();
    }
    expect(calls).toHaveLength(0);
    // a valid state that names no field is all defaults: that one is asked
    expect((await open(definition, 3, "e30")).neighbors.position.value).toBe(3);
    expect(calls).toHaveLength(1);
  });

  it("is empty when the record is not in the list any more, and back still keeps the list's state", async () => {
    const { definition } = setup();
    const from = stateOf(definition, { page: 2, search: "Ticket", pageSize: 8 });
    const { neighbors } = await open(definition, 99, from);
    expect(neighbors.position.value).toBeNull();
    expect(neighbors.context.neighbors).toBeNull();
    expect(neighbors.context.back).toEqual({ label: "Tickets", to: { name: "list", query: { query: from } } });
  });

  it("caches pages, and does not cache a failure", async () => {
    let failing: number | null = 2;
    const { definition, calls } = setup({ failPage: () => failing });
    const from = stateOf(definition, { page: 1 });
    const router = await makeRouter(`/records/5?from=${from}`);
    const { result: neighbors } = inApp(() => {
      const route = useRoute();
      return useCollectionNeighbors(definition, { current: () => route.params.recordID as string, list: { name: "list" }, param: "recordID", backLabel: "Tickets" });
    }, { router });
    await flush();
    expect(neighbors.position.value).toBe(5);
    expect(neighbors.next.value).toBeNull(); // page 2 could not be read

    failing = null;
    await router.push(`/records/4?from=${from}`);
    await flush();
    expect(neighbors.next.value?.key).toBe(5);
    await router.push(`/records/5?from=${from}`);
    await flush();
    expect(neighbors.next.value?.key).toBe(6); // the failed page was asked again, not served from the cache
    const requests = calls.length;
    await router.push(`/records/4?from=${from}`);
    await router.push(`/records/5?from=${from}`);
    await flush();
    expect(calls.length).toBe(requests); // page 1 and 2 are cached now
  });

  it("finds records by any key, not only numbers (ARV read Number(item.id))", async () => {
    const rows = ["a1", "b2", "c3"].map((id) => ({ id, title: id }));
    const loader = fakeLoader(() => page(rows as never, { lastPage: 1, total: 3 }));
    const definition = defineCollection({ id: "codes", stateVersion: 1, load: loader.load as never, key: (row: { id: string }) => row.id, defaults: { pageSize: 5 } });
    const router = await makeRouter(`/records/b2?from=${encodeState(definition, definition.defaults)}`);
    const { result } = inApp(() => {
      const route = useRoute();
      return useCollectionNeighbors(definition, { current: () => route.params.recordID as string, list: { name: "list" }, param: "recordID", backLabel: "Tickets" });
    }, { router });
    await flush();
    expect(result.position.value).toBe(2);
    expect(result.previous.value?.key).toBe("a1");
    expect(result.next.value?.key).toBe("c3");
  });

  it("keeps the cache bounded", async () => {
    const { definition, calls } = setup();
    const at = (page: number) => stateOf(definition, { page });
    const router = await makeRouter(`/records/1?from=${at(1)}`);
    const { result: neighbors } = inApp(() => {
      const route = useRoute();
      return useCollectionNeighbors(definition, { current: () => route.params.recordID as string, list: { name: "list" }, param: "recordID", backLabel: "Tickets" });
    }, { router });
    await flush();
    expect(neighbors.position.value).toBe(1);
    const afterFirst = calls.length;
    // ten distinct queries (search) fill and overflow the cache
    for (let n = 0; n < 10; n++) {
      await router.push(`/records/1?from=${stateOf(definition, { search: n === 0 ? "Ticket" : `Ticket ${n}` })}`);
      await flush();
    }
    const before = calls.length;
    await router.push(`/records/1?from=${at(1)}`);
    await flush();
    expect(calls.length).toBeGreaterThan(before); // the first query was evicted and is fetched again
    expect(afterFirst).toBeGreaterThan(0);
  });

  it("forgets what it cached when the session changes", async () => {
    const platform = createPlatform({ config: parseBootstrap({ locale: "en", app_name: "T", api_base: "/api" }), transport: async () => new Response("{}") });
    platform.session.establish(snapshotOf(1));
    const { definition, calls } = setup();
    const { neighbors } = await open(definition, 2, stateOf(definition, { page: 1 }), platform);
    expect(neighbors.position.value).toBe(2);
    const before = calls.length;
    platform.session.establish(snapshotOf(2));
    await flush();
    expect(calls.length).toBeGreaterThan(before);
    expect(neighbors.position.value).toBe(2);
  });
});
