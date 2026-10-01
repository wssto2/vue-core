import { defineCollection, useCollection } from "@wssto2/vue-core/collection";
import { fakeLoader, listPage, settle, withSetup } from "@wssto2/vue-core/testing";
import { describe, expect, it } from "vitest";
import type { Ticket } from "../api";

const tickets: Ticket[] = [
  { id: 1, subject: "Printer", status: "open", assignee: null, created_at: "2026-09-30T08:00:00Z" },
  { id: 2, subject: "Router", status: "closed", assignee: "Ana", created_at: "2026-09-29T08:00:00Z" },
];

describe("a collection", () => {
  it("asks the backend for what the user chose, and shows the page it answered", async () => {
    // The loader answers from the query and records every call: assert on what was asked.
    const { load, calls } = fakeLoader<Ticket>(() => listPage(tickets));
    const definition = defineCollection({ id: "tickets", stateVersion: 1, load, key: (ticket) => ticket.id, query: { sorts: ["subject"], filters: ["status"] } });
    const { result: list, unmount } = withSetup(() => useCollection(definition, { state: { kind: "memory" } }));

    await settle();
    expect(list.rows.value.map((ticket) => ticket.subject)).toEqual(["Printer", "Router"]);

    list.sortBy("subject");
    list.setFilter("status", "open");
    await settle();
    expect(calls.at(-1)?.query).toMatchObject({ sort: "subject", filters: { status: "open" }, page: 1 });
    expect(calls).toHaveLength(2); // both commands, one request
    unmount();
  });
});
