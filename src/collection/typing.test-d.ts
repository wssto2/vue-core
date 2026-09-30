// Type fixtures, checked by `npm run typecheck`: the query contract and the columns are typed, not stringly.
import { computed } from "vue";
import { defineCollection } from "./definition";
import type { CollectionColumns } from "./columns";
import type { SortOf } from "./definition";
import type { ListPage } from "./types";
import { useCollection } from "./useCollection";

interface Ticket {
  readonly id: number;
  readonly title: string;
  readonly status: "open" | "closed";
  readonly assignee: { readonly name: string } | null;
  readonly created_at: string;
}

const empty: ListPage<Ticket> = { rows: [], total: 0, page: 1, pageSize: 25, lastPage: 0, from: 0, to: 0 };

export const tickets = defineCollection({
  id: "helpdesk.tickets",
  stateVersion: 1,
  // the loader's query is typed by the contract: sort keys, filter keys and views are what it declares
  load: async (query): Promise<ListPage<Ticket>> => {
    const sort: "created_at" | "title" | null = query.sort;
    const status: string | undefined = query.filters.status;
    // @ts-expect-error a filter the contract does not declare
    void query.filters.nope;
    void sort;
    void status;
    return empty;
  },
  key: (ticket) => ticket.id, // the row type comes from the loader
  query: { sorts: ["created_at", "title"], filters: ["status", "assignee"], views: ["mine", "all"] },
  defaults: { sort: "created_at", direction: "desc" },
});

defineCollection({
  id: "x",
  stateVersion: 1,
  load: async () => empty,
  key: (ticket) => ticket.id,
  query: { sorts: ["created_at"] },
  // @ts-expect-error a default sort the contract does not list
  defaults: { sort: "title" },
});

defineCollection({
  id: "x",
  stateVersion: 1,
  load: async () => empty,
  // @ts-expect-error the key function gets the row the loader returns
  key: (ticket) => ticket.nope,
});

export function page() {
  const columns = computed(
    () =>
      [
        { key: "title", label: "Title", kind: "identity", sort: "title", mobile: "primary" },
        { key: "status", label: "Status", kind: "badge", tone: (ticket: Ticket) => (ticket.status === "open" ? "positive" : "neutral") },
        { key: "assignee.name", label: "Assignee", mobile: "meta" },
        { key: "created_at", label: "Created", kind: "timestamp", sort: "created_at" },
      ] satisfies CollectionColumns<Ticket>,
  );

  const list = useCollection(tickets, { columns, state: { kind: "url", key: "query" }, recordRoute: (ticket) => `/tickets/${ticket.id}` });

  list.sortBy("title");
  // @ts-expect-error an unsupported sort key
  list.sortBy("nope");
  list.toggleSort("created_at");
  list.setFilter("status", "open");
  // @ts-expect-error an unsupported filter key
  list.setFilter("nope", "x");
  list.setView("mine");
  // @ts-expect-error a view the contract does not declare
  list.setView("everyone");

  const first: Ticket | undefined = list.rows.value[0];
  void first;

  useCollection(tickets, {
    // @ts-expect-error a column key that is not a property of the row
    columns: [{ key: "nope", label: "Nope" }],
    state: { kind: "memory" },
  });

  // A column's sort key is checked against the contract at setup (see the runtime test); written against the
  // definition's own sort keys the type rejects it too:
  const strict = [
    // @ts-expect-error a column sort key the contract does not list
    { key: "title", label: "Title", sort: "nope" },
  ] satisfies CollectionColumns<Ticket, SortOf<typeof tickets>>;
  void strict;

  useCollection(tickets, {
    // @ts-expect-error a badge column needs its tone
    columns: [{ key: "status", label: "Status", kind: "badge" }],
    state: { kind: "memory" },
  });

  useCollection(tickets, {
    // @ts-expect-error money needs its currency
    columns: [{ key: "id", label: "Amount", kind: "money" }],
    state: { kind: "memory" },
  });

  // @ts-expect-error a state source is a url key or memory
  useCollection(tickets, { state: { kind: "local" } });

  useCollection(tickets, {
    state: { kind: "memory" },
    filters: [{ key: "status", label: "Status", type: "select" }],
  });
  useCollection(tickets, {
    state: { kind: "memory" },
    // @ts-expect-error a filter the contract does not declare
    filters: [{ key: "nope", label: "Nope", type: "select" }],
  });

  return list;
}
