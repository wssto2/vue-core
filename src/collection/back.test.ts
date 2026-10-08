import { describe, expect, it } from "vitest";
import { defineCollection } from "./definition";
import { useCollectionBack } from "./back";
import { encodeState } from "./state";
import { fakeLoader, flush, inApp, makeRouter, page, type Row } from "./testing";
import type { CollectionQuery } from "./types";

function setup() {
  const loader = fakeLoader(() => page([] as Row[], { page: 1, pageSize: 5, total: 0, lastPage: 1 }));
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

async function open(from: string | null) {
  const { definition, calls } = setup();
  const router = await makeRouter(`/records/3${from === null ? "" : `?from=${from}`}`);
  const { result } = inApp(() => useCollectionBack(definition, { list: { name: "list" }, backLabel: () => "Tickets" }), { router });
  await flush();
  return { back: result, calls, definition };
}

describe("useCollectionBack", () => {
  it("leads back to the list with the state it was opened with, and asks for nothing", async () => {
    const { definition } = setup();
    const from = encodeState(definition, { ...definition.defaults, page: 3, pageSize: 8, search: "printer", filters: { status: "open" } } as CollectionQuery<"title", "status", "mine">);
    const { back, calls } = await open(from);
    expect(back.back).toEqual({ label: "Tickets", to: { name: "list", query: { query: from } } });
    expect(back.neighbors).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("leads to the plain list from a direct link or from state it cannot trust", async () => {
    for (const from of [null, "garbage", btoa(JSON.stringify({ v: 7, p: 1 }))]) {
      const { back } = await open(from);
      expect(back.back.to).toEqual({ name: "list" });
    }
  });
});
