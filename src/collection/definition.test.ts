import { describe, expect, it } from "vitest";
import { defineCollection } from "./definition";
import { decodeState, encodeState, queryKey } from "./state";
import { fakeLoader, page } from "./testing";

const make = (extra: Partial<Parameters<typeof defineCollection<{ id: number; title: string }>>[0]> = {}) =>
  defineCollection({
    id: "tickets",
    stateVersion: 2,
    load: fakeLoader(() => page([])).load,
    key: (row) => row.id,
    query: { sorts: ["created_at", "title"], filters: ["status", "assignee", "ssn"], views: ["mine", "all"], sensitive: ["ssn"] },
    defaults: { sort: "created_at", direction: "desc" },
    ...extra,
  });

const compact = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

describe("defineCollection", () => {
  it("is pure: it completes the defaults and starts nothing", () => {
    const calls: unknown[] = [];
    const definition = defineCollection({ id: "a", stateVersion: 1, load: async (q) => (calls.push(q), page([])), key: (row: { id: number }) => row.id });
    expect(calls).toEqual([]);
    expect(definition.defaults).toEqual({ page: 1, pageSize: 25, sort: null, direction: "asc", search: "", view: null, filters: {} });
    expect(Object.isFrozen(definition)).toBe(true);
  });

  it("is searchable unless the contract says the backend does not search", () => {
    expect(make().contract.search).toBe(true);
    expect(make({ query: { search: false } }).contract.search).toBe(false);
  });

  it.each([
    ["an empty id", { id: " " }],
    ["a zero version", { stateVersion: 0 }],
    ["a default sort the contract does not list", { defaults: { sort: "nope" } }],
    ["a default page size that is not offered", { defaults: { pageSize: 7 } }],
    ["a default filter the contract does not list", { defaults: { filters: { nope: "1" } } }],
    ["a sensitive filter that is not a filter", { query: { filters: ["status"], sensitive: ["ssn"] } }],
  ])("refuses %s", (_name, extra) => {
    expect(() => make(extra as never)).toThrow(/defineCollection/);
  });
});

describe("state text", () => {
  const definition = make();

  it("round-trips a query and leaves sensitive filters out", () => {
    const query = { ...definition.defaults, page: 3, search: "čšž", view: "mine" as const, filters: { status: "open", ssn: "123" } };
    const encoded = encodeState(definition, query);
    expect(decodeState(definition, encoded)).toEqual({ ...query, filters: { status: "open" } });
    expect(atob(encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "="))).not.toContain("123");
  });

  it("reads ARV's link (no version, compact keys) as the current version", () => {
    const arv = compact({ p: 2, l: 10, c: "title", d: "asc", s: "golf", f: { status: 4 } });
    expect(decodeState(definition, arv)).toMatchObject({ page: 2, pageSize: 10, sort: "title", direction: "asc", search: "golf", filters: { status: "4" } });
  });

  it("replaces every invalid field by its default, never passing it on", () => {
    const hostile = compact({ v: 2, p: -4, l: 100000, c: "drop table", d: "sideways", s: "x".repeat(500), w: "admin", f: { nope: "1", status: { a: 1 }, assignee: "7" } });
    expect(decodeState(definition, hostile)).toEqual({ ...definition.defaults, filters: { assignee: "7" } });
  });

  it("returns null for garbage, non-objects and oversized text", () => {
    for (const raw of [null, "", "%%%", compact([1, 2]), compact("text"), "a".repeat(5000)]) expect(decodeState(definition, raw)).toBeNull();
  });

  it("resets state of another version without a migration and migrates it with one", () => {
    const old = compact({ v: 1, p: 5, c: "created", d: "asc" });
    expect(decodeState(definition, old)).toBeNull();

    const migrating = make({ migrate: (stored, version) => (version === 1 ? { ...stored, v: 2, c: stored.c === "created" ? "created_at" : stored.c } : null) });
    expect(decodeState(migrating, old)).toMatchObject({ page: 5, sort: "created_at", direction: "asc" });
    expect(decodeState(migrating, compact({ v: 0 }))).toBeNull();
  });

  it("a cleared default filter stays cleared", () => {
    const withDefault = make({ defaults: { sort: "created_at", filters: { status: "open" } } });
    expect(decodeState(withDefault, encodeState(withDefault, { ...withDefault.defaults, filters: {} }))?.filters).toEqual({});
    expect(decodeState(withDefault, compact({ p: 2 }))?.filters).toEqual({ status: "open" });
  });

  it("queryKey ignores filter order", () => {
    expect(queryKey({ ...definition.defaults, filters: { status: "a", assignee: "b" } })).toBe(queryKey({ ...definition.defaults, filters: { assignee: "b", status: "a" } }));
  });
});
