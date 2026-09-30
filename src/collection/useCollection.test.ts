import { describe, expect, it, vi } from "vitest";
import { effectScope, nextTick } from "vue";
import { ApiError } from "../client";
import { createPlatform, parseBootstrap } from "../platform";
import { snapshotOf } from "../platform/testing";
import { defineCollection } from "./definition";
import { createMemorySavedViews } from "./savedViews";
import { decodeState, encodeState } from "./state";
import { abortable, deferred, fakeLoader, flush, inApp, makeRouter, page, type Row } from "./testing";
import { useCollection } from "./useCollection";

const rows = (...ids: number[]): Row[] => ids.map((id) => ({ id, title: `Ticket ${id}` }));

function setup(loader = fakeLoader(() => page(rows(1, 2, 3), { lastPage: 9, total: 200 })), state: Parameters<typeof useCollection>[1]["state"] = { kind: "memory" }) {
  const definition = defineCollection({
    id: "tickets",
    stateVersion: 1,
    load: loader.load,
    key: (row: Row) => row.id,
    query: { sorts: ["created_at", "title"], filters: ["status", "assignee", "ssn"], views: ["mine", "all"], sensitive: ["ssn"] },
    defaults: { sort: "created_at", direction: "desc" },
  });
  return { definition, ...loader, state };
}

describe("loading", () => {
  it("loads once on creation, after the setup that may adjust filters, and exposes the page", async () => {
    const { definition, calls } = setup();
    const scope = effectScope();
    const list = scope.run(() => {
      const created = useCollection(definition, { state: { kind: "memory" } });
      created.setFilter("status", "open"); // adjusting right after creation must not cost a second request
      return created;
    })!;
    expect(list.state.value.status).toBe("loading");
    expect(list.display.value).toBe("loading");
    await flush();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.query).toMatchObject({ page: 1, pageSize: 25, sort: "created_at", direction: "desc", filters: { status: "open" } });
    expect(list.state.value.status).toBe("loaded");
    expect(list.rows.value.map((row) => row.id)).toEqual([1, 2, 3]);
    expect(list.total.value).toBe(200);
    expect(list.display.value).toBe("rows");
    scope.stop();
  });

  it("batches commands of one tick into one request", async () => {
    const { definition, calls } = setup();
    const list = useCollection(definition, { state: { kind: "memory" } });
    await flush();
    list.search("golf");
    list.setFilters({ status: "open", assignee: 4 });
    list.setView("mine");
    await flush();
    expect(calls).toHaveLength(2);
    expect(calls[1]!.query).toMatchObject({ search: "golf", view: "mine", page: 1, filters: { status: "open", assignee: "4" } });
  });

  it("the latest request wins: a slow older answer is dropped and its request is aborted", async () => {
    const slow = deferred<ReturnType<typeof page>>();
    const loader = fakeLoader((query, { signal }) => (query.search === "a" ? abortable(signal, slow.promise) : page(rows(9), { total: 1 })));
    const { definition, calls } = setup(loader);
    const list = useCollection(definition, { state: { kind: "memory" } });
    await flush();
    list.search("a");
    await flush();
    list.search("b");
    await flush();
    expect(calls[1]!.signal.aborted).toBe(true);
    slow.resolve(page(rows(1)));
    await flush();
    expect(list.rows.value.map((row) => row.id)).toEqual([9]);
    expect(list.query.value.search).toBe("b");
  });

  it("a cancelled request is not a failure", async () => {
    const never = deferred<ReturnType<typeof page>>();
    const loader = fakeLoader((query, { signal }) => (query.page === 2 ? abortable(signal, never.promise) : page(rows(1), { lastPage: 3, total: 3 })));
    const { definition } = setup(loader);
    const list = useCollection(definition, { state: { kind: "memory" } });
    await flush();
    list.goToPage(2);
    await flush();
    void list.refresh().catch(() => undefined);
    list.goToPage(1);
    await flush();
    expect(list.error.value).toBeNull();
    expect(list.state.value.status).toBe("loaded");
  });

  it("a disposed list aborts what is running and ignores its answer", async () => {
    const pending = deferred<ReturnType<typeof page>>();
    const loader = fakeLoader((_q, { signal }) => abortable(signal, pending.promise));
    const { definition, calls } = setup(loader);
    const scope = effectScope();
    const list = scope.run(() => useCollection(definition, { state: { kind: "memory" } }))!;
    await flush();
    scope.stop();
    expect(calls[0]!.signal.aborted).toBe(true);
    pending.resolve(page(rows(1)));
    await flush();
    expect(list.state.value.status).toBe("loading");
    list.search("late");
    await flush();
    expect(calls).toHaveLength(1);
  });
});

describe("states", () => {
  it("tells empty, no matches and failed apart", async () => {
    const loader = fakeLoader((query) => {
      if (query.filters.status === "boom") throw new ApiError({ kind: "server", message: "Database is down", status: 500, requestId: "req-1" });
      return page([]);
    });
    const { definition } = setup(loader);
    const list = useCollection(definition, { state: { kind: "memory" } });
    await flush();
    expect(list.display.value).toBe("empty");
    list.search("golf");
    await flush();
    expect(list.display.value).toBe("no-matches");
    list.clearFilters();
    list.setFilter("status", "boom");
    await flush();
    expect(list.display.value).toBe("failed");
    expect(list.state.value).toEqual({ status: "failed", error: "Database is down" });
    expect((list.error.value as ApiError).requestId).toBe("req-1");
  });

  it("refresh keeps the rows while it runs and after it failed (stale), and recovers", async () => {
    let mode: "ok" | "slow" | "fail" = "ok";
    const gate = deferred<void>();
    const loader = fakeLoader(async () => {
      if (mode === "slow") await gate.promise;
      if (mode === "fail") throw new ApiError({ kind: "network", message: "offline" });
      return page(rows(1, 2));
    });
    const { definition } = setup(loader);
    const list = useCollection(definition, { state: { kind: "memory" } });
    await flush();

    mode = "slow";
    const refreshing = list.refresh();
    await flush();
    expect(list.state.value.status).toBe("refreshing");
    expect(list.rows.value).toHaveLength(2);
    expect(list.display.value).toBe("rows");
    gate.resolve();
    await refreshing;
    expect(list.state.value.status).toBe("loaded");

    mode = "fail";
    await list.refresh();
    expect(list.state.value).toMatchObject({ status: "stale", error: "offline" });
    expect(list.rows.value).toHaveLength(2);

    mode = "ok";
    await list.refresh();
    expect(list.state.value.status).toBe("loaded");
    expect(list.error.value).toBeNull();
  });

  it("a changed query shows skeleton rows (loading), not the previous rows", async () => {
    const gate = deferred<void>();
    let hold = false;
    const { definition } = setup(fakeLoader(async () => (hold ? (await gate.promise, page(rows(5))) : page(rows(1)))));
    const list = useCollection(definition, { state: { kind: "memory" } });
    await flush();
    hold = true;
    list.nextPage();
    list.goToPage(2);
    await flush();
    expect(list.state.value.status).toBe("loading");
    gate.resolve();
    await flush();
    expect(list.rows.value.map((row) => row.id)).toEqual([5]);
  });

  it("goes to the last page when the current one emptied (rows deleted)", async () => {
    const loader = fakeLoader((query) => (query.page > 2 ? page([], { page: query.page, lastPage: 2, total: 50 }) : page(rows(query.page), { page: query.page, lastPage: 2, total: 50 })));
    const { definition, calls } = setup(loader);
    const list = useCollection(definition, { state: { kind: "memory" } });
    await flush();
    list.goToPage(3);
    await flush(8);
    expect(calls.map((call) => call.query.page)).toEqual([1, 3, 2]);
    expect(list.query.value.page).toBe(2);
    expect(list.rows.value.map((row) => row.id)).toEqual([2]);
  });

  it("page commands respect the bounds and the offered sizes; sort keeps the page, filters reset it", async () => {
    const { definition, calls } = setup(fakeLoader(() => page(rows(1), { lastPage: 3, total: 60 })));
    const list = useCollection(definition, { state: { kind: "memory" } });
    await flush();
    list.previousPage();
    list.nextPage();
    list.nextPage();
    list.nextPage();
    expect(list.query.value.page).toBe(3);
    list.toggleSort("title");
    expect(list.query.value).toMatchObject({ page: 3, sort: "title", direction: "asc" });
    list.toggleSort("title");
    expect(list.query.value.direction).toBe("desc");
    list.setPageSize(7);
    expect(list.query.value.pageSize).toBe(25);
    list.setPageSize(50);
    expect(list.query.value).toMatchObject({ pageSize: 50, page: 1 });
    list.setFilter("status", "");
    expect(list.query.value.filters).toEqual({});
    await flush();
    expect(calls.length).toBe(2);
  });
});

describe("URL state", () => {
  it("writes the state under its key, keeps other parameters and restores it on creation", async () => {
    const router = await makeRouter("/list?keep=1");
    const { definition, calls } = setup();
    const { result: list } = inApp(() => useCollection(definition, { state: { kind: "url", key: "query" } }), { router });
    await flush();
    expect(router.currentRoute.value.query.keep).toBe("1");
    expect(decodeState(definition, router.currentRoute.value.query.query)).toEqual(definition.defaults);

    list.search("golf");
    list.goToPage(2);
    await flush();
    expect(decodeState(definition, router.currentRoute.value.query.query)).toMatchObject({ search: "golf", page: 2 });
    expect(calls).toHaveLength(2);

    const second = await makeRouter(`/list?query=${router.currentRoute.value.query.query}`);
    const again = inApp(() => useCollection(definition, { state: { kind: "url", key: "query" } }), { router: second }).result;
    await flush();
    expect(again.query.value).toMatchObject({ search: "golf", page: 2 });
  });

  it("follows back and forward", async () => {
    const router = await makeRouter();
    const { definition, calls } = setup();
    const { result: list } = inApp(() => useCollection(definition, { state: { kind: "url", key: "query" } }), { router });
    await flush();
    const first = router.currentRoute.value.fullPath;
    await router.push({ path: "/list", query: { query: encodeState(definition, { ...definition.defaults, search: "pushed" }) } });
    await flush();
    expect(list.query.value.search).toBe("pushed");
    expect(calls.at(-1)!.query.search).toBe("pushed");

    router.back();
    await flush(8);
    expect(router.currentRoute.value.fullPath).toBe(first);
    expect(list.query.value.search).toBe("");
    router.forward();
    await flush(8);
    expect(list.query.value.search).toBe("pushed");
    // going back and forward does not make the list write over the history it follows
    expect(router.currentRoute.value.query.query).toBe(encodeState(definition, { ...definition.defaults, search: "pushed" }));
  });

  it("validates what it reads: hostile state falls back to the defaults", async () => {
    const hostile = btoa(JSON.stringify({ v: 1, p: -1, l: 999, c: "x;y", d: "up", f: { evil: "1" } }));
    const router = await makeRouter(`/list?query=${hostile}`);
    const { definition } = setup();
    const { result: list } = inApp(() => useCollection(definition, { state: { kind: "url", key: "query" } }), { router });
    await flush();
    expect(list.query.value).toEqual(definition.defaults);
    expect(router.currentRoute.value.query.query).toBe(encodeState(definition, definition.defaults));
  });

  it("never writes into another page's URL after the user left", async () => {
    const router = await makeRouter();
    const gate = deferred<void>();
    const { definition } = setup(fakeLoader(async () => (await gate.promise, page(rows(1)))));
    const { result: list } = inApp(() => useCollection(definition, { state: { kind: "url", key: "query" } }), { router });
    await flush();
    await router.push("/records/7");
    list.search("late");
    gate.resolve();
    await flush();
    expect(router.currentRoute.value.path).toBe("/records/7");
    expect(router.currentRoute.value.query).toEqual({});
  });

  it("two lists on one page keep separate state under separate keys, and sharing a key is an error", async () => {
    const router = await makeRouter();
    const a = setup();
    const b = { ...setup(), definition: defineCollection({ id: "other", stateVersion: 1, load: fakeLoader(() => page(rows(8), { lastPage: 9, total: 200 })).load, key: (row: Row) => row.id }) };
    const { result } = inApp(
      () => ({ one: useCollection(a.definition, { state: { kind: "url", key: "one" } }), two: useCollection(b.definition, { state: { kind: "url", key: "two" } }) }),
      { router },
    );
    await flush();
    result.one.search("x");
    await flush();
    result.two.goToPage(2);
    await flush();
    expect(decodeState(a.definition, router.currentRoute.value.query.one)).toMatchObject({ search: "x", page: 1 });
    expect(decodeState(b.definition, router.currentRoute.value.query.two)).toMatchObject({ search: "", page: 2 });
    expect(result.one.query.value.page).toBe(1);

    expect(() => inApp(() => ({ one: useCollection(a.definition, { state: { kind: "url", key: "k" } }), two: useCollection(b.definition, { state: { kind: "url", key: "k" } }) }), { router })).toThrow(/already used by the list "tickets"/);
  });

  it("a URL state needs the router, with a message that says so", () => {
    const { definition } = setup();
    expect(() => inApp(() => useCollection(definition, { state: { kind: "url", key: "query" } }))).toThrow(/needs the application's router/);
  });

  it("record links carry the state; memory lists add nothing", async () => {
    const router = await makeRouter();
    const { definition } = setup();
    const { result: list } = inApp(
      () => useCollection(definition, { state: { kind: "url", key: "query" }, recordRoute: (row) => ({ name: "record", params: { recordID: row.id } }) }),
      { router },
    );
    await flush();
    const link = list.recordLocation({ id: 5, title: "t" }) as { name: string; params: object; query: { from: string } };
    expect(link).toMatchObject({ name: "record", params: { recordID: 5 } });
    expect(decodeState(definition, link.query.from)).toEqual(definition.defaults);
    expect(list.linkContext()).toEqual({ from: link.query.from });

    const memory = inApp(() => useCollection(definition, { state: { kind: "memory" }, recordRoute: () => "/records/5" })).result;
    expect(memory.recordLocation({ id: 5, title: "t" })).toBe("/records/5");
    expect(memory.linkContext()).toEqual({});
  });

  it("keeps sensitive filters out of the URL but still filters by them", async () => {
    const router = await makeRouter();
    const { definition, calls } = setup();
    const { result: list } = inApp(() => useCollection(definition, { state: { kind: "url", key: "query" } }), { router });
    await flush();
    list.setFilter("ssn", "12345678901");
    await flush();
    expect(calls.at(-1)!.query.filters).toEqual({ ssn: "12345678901" });
    expect(JSON.stringify(router.currentRoute.value.query)).not.toContain("12345678901");
    expect(atob(String(router.currentRoute.value.query.query).replace(/-/g, "+").replace(/_/g, "/"))).not.toContain("ssn");
  });

  it("applies the plain parameters of a link once and drops them from the URL", async () => {
    const router = await makeRouter("/list?followup=overdue&mine=1&line_name=Golf&keep=1");
    const { definition, calls } = setup();
    const { result: list } = inApp(
      () =>
        useCollection(definition, {
          state: { kind: "url", key: "query" },
          linked: { params: { followup: "status", mine: { filter: "assignee", value: () => 42 } }, consume: ["line_name"] },
        }),
      { router },
    );
    await flush();
    expect(calls).toHaveLength(1);
    expect(list.query.value.filters).toEqual({ status: "overdue", assignee: "42" });
    const query = router.currentRoute.value.query;
    expect(Object.keys(query).sort()).toEqual(["keep", "query"]);
  });
});

describe("session", () => {
  it("drops the page, cancels the request and clears saved views when who is signed in changes", async () => {
    const platform = createPlatform({ config: parseBootstrap({ locale: "en", app_name: "T", api_base: "/api" }), transport: async () => new Response("{}") });
    platform.session.establish(snapshotOf(1));
    const pending = deferred<ReturnType<typeof page>>();
    const loader = fakeLoader((_q, { signal }, call) => (call === 1 ? page(rows(1)) : call === 2 ? abortable(signal, pending.promise) : page(rows(3))));
    const { definition, calls } = setup(loader);
    const savedViews = createMemorySavedViews({ [definition.id]: [{ id: 1, name: "mine", state: { version: 1, filters: { status: "open" }, search: "" } }] });
    const { result: list } = inApp(() => useCollection(definition, { state: { kind: "memory" }, savedViews }), { platform });
    await flush();
    await list.savedViews!.load();
    expect(list.savedViews!.items.value).toHaveLength(1);

    platform.session.establish(snapshotOf(2));
    expect(list.state.value.status).toBe("loading");
    expect(list.savedViews!.items.value).toHaveLength(0);
    await flush();
    expect(calls).toHaveLength(2);
    platform.session.establish(snapshotOf(3));
    expect(calls[1]!.signal.aborted).toBe(true);
    pending.resolve(page(rows(99)));
    await flush();
    expect(list.rows.value.map((row) => row.id)).toEqual([3]);
  });

  it("does not reload when nobody is signed in any more", async () => {
    const platform = createPlatform({ config: parseBootstrap({ locale: "en", app_name: "T", api_base: "/api" }), transport: async () => new Response("{}") });
    platform.session.establish(snapshotOf(1));
    const { definition, calls } = setup();
    inApp(() => useCollection(definition, { state: { kind: "memory" } }), { platform });
    await flush();
    await platform.session.signOut().catch(() => undefined);
    await flush();
    expect(calls).toHaveLength(1);
  });
});

describe("saved views", () => {
  it("saves, lists, applies, removes with undo, and skips views of a version it cannot read", async () => {
    const { definition, calls } = setup();
    const savedViews = createMemorySavedViews({ tickets: [{ id: "old", name: "Old", state: { version: 9, filters: { status: "x" }, search: "" } }] });
    const { result: list } = inApp(() => useCollection(definition, { state: { kind: "memory" }, savedViews }), {});
    await flush();
    const saved = list.savedViews!;
    await saved.load();
    expect(saved.items.value).toEqual([]); // version 9 cannot be read: hidden, not misapplied

    list.setFilter("status", "open");
    list.search("golf");
    list.setFilter("ssn", "secret");
    const view = await saved.save("Open golf");
    expect(view.state).toEqual({ version: 1, filters: { status: "open" }, search: "golf", view: null });
    expect(saved.items.value.map((item) => item.name)).toEqual(["Open golf"]);

    list.clearFilters();
    list.goToPage(1);
    saved.apply(view);
    await flush();
    expect(calls.at(-1)!.query).toMatchObject({ filters: { status: "open" }, search: "golf", page: 1 });

    const staged = saved.stageRemoval(view.id);
    expect(saved.items.value).toEqual([]);
    staged.revert();
    expect(saved.items.value).toHaveLength(1);
    const again = saved.stageRemoval(view.id);
    await again.commit();
    expect(await savedViews.list("tickets", { signal: new AbortController().signal })).toHaveLength(1); // only the unreadable one remains

    const one = await saved.save("Dup");
    const two = await saved.save("Dup", { filters: { status: "closed" } });
    expect(two.id).toBe(one.id);
    expect(saved.items.value.filter((item) => item.name === "Dup")).toHaveLength(1);
  });

  it("a load that fails leaves the list usable", async () => {
    const { definition } = setup();
    const failing = { list: vi.fn().mockRejectedValue(new Error("x")), save: vi.fn(), remove: vi.fn() };
    const { result: list } = inApp(() => useCollection(definition, { state: { kind: "memory" }, savedViews: failing }));
    await list.savedViews!.load();
    expect(list.savedViews!.status.value).toBe("failed");
    await nextTick();
    expect(list.display.value).toBe("rows");
  });
});
