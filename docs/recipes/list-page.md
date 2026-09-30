# Recipe: a list page

A list is a **collection definition** (pure data and a loader), a **columns array**, and `<CollectionPage>`. The page supplies the data and the words; the library writes the toolbar, the table, the phone rows, search, filters, sorting, paging, the loading / empty / no-match / failed states, and keeps the list's state in the URL.

## 1. The definition

One definition per list, made where the API is: the list page and the record page's previous / next both read it, so they always agree on what "the list" is.

<!-- example: docs/examples/tickets/collection.ts -->
```ts
import { defineCollection } from "@wssto2/vue-core/collection";
import type { TicketsApi } from "./api";

// One definition: the list page and the record page's previous / next both read it, so they
// always agree on what "the list" is (its sorts, filters and default state).
export function createTicketList(api: TicketsApi) {
  return defineCollection({
    id: "tickets",
    stateVersion: 1, // bump it when the state's shape changes: stored links and saved views of the old one are dropped
    load: api.list,
    key: (ticket) => ticket.id,
    query: { sorts: ["created_at", "subject"], filters: ["status"] },
    defaults: { sort: "created_at", direction: "desc" },
  });
}
```

- `load(query, { signal })` returns one page: `{ rows, total, page, pageSize, lastPage, from, to }`. `httpList` (from `@wssto2/vue-core/collection`) is the loader for go-core's list endpoints; any function of that shape works. `signal` aborts when a newer request supersedes the call, so pass it on to `fetch`.
- `query.sorts` and `query.filters` are the keys the backend accepts. They type everything downstream: sorting by or filtering on another key is a compile error.
- `stateVersion` is part of a stored state (URL links, saved views). Raise it when `sorts`, `filters` or `defaults` change meaning; older states are then ignored instead of misread.

## 2. The page

<!-- example: docs/examples/tickets/views/Index.vue -->
```vue
<script setup lang="ts">
import { CollectionPage, useCollection, type CollectionColumns } from "@wssto2/vue-core/collection";
import { toast } from "@wssto2/vue-core/overlay";
import type { PageAction } from "@wssto2/vue-core/page";
import { usePlatform } from "@wssto2/vue-core/platform";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { Ticket } from "../api";
import { useTickets } from "../context";
import { ticketRoutes } from "../routes";

const { t } = useI18n();
const { access } = usePlatform();
const { list } = useTickets();

// One columns array drives the table and the phone row: `mobile` says what a column is on a phone.
const columns = computed(() => [
  { key: "subject", label: t("tickets.subject"), kind: "identity", sort: "subject", mobile: "primary" },
  { key: "status", label: t("tickets.status"), kind: "badge", tone: (ticket: Ticket) => (ticket.status === "open" ? "warning" : "positive"), text: (ticket: Ticket) => t(`tickets.${ticket.status}`), mobile: "accessory" },
  { key: "assignee", label: t("tickets.assignee"), hideBelow: "md", mobile: "meta" },
  { key: "created_at", label: t("tickets.created"), kind: "timestamp", sort: "created_at", width: 160, mobile: "meta" },
] satisfies CollectionColumns<Ticket>);

const filters = computed(() => [
  { key: "status" as const, label: t("tickets.status"), type: "select" as const, options: [{ value: "open", label: t("tickets.open") }, { value: "closed", label: t("tickets.closed") }] },
]);

// State (page, sort, search, filters) lives in the URL under `query`; a row links to its record, carrying it.
const tickets = useCollection(list, {
  columns,
  filters,
  state: { kind: "url", key: "query" },
  recordRoute: (ticket) => ticketRoutes.record({ ticketID: ticket.id }),
});

// Only actions the user may use; the page decides where they render.
const actions = computed<PageAction[]>(() =>
  access.can("tickets:update")
    ? [{ id: "create", label: t("tickets.create"), placement: "primary", keyboardShortcut: { key: "N", ctrlKey: true }, onClick: () => toast.info(t("tickets.create")) }]
    : [],
);
</script>

<template>
  <CollectionPage :collection="tickets" :title="t('tickets.title')" :description="t('tickets.description')" :actions="actions" />
</template>
```

What to know:

- **Columns are data.** `kind` is `text` (default), `identity` (the record's name as a real link to `recordRoute`, with an optional quiet `subtitle`), `timestamp`, `number`, `money`, `badge` (a `tone` carries the meaning) or `custom`. A `sort` key makes the header sortable. Write the array with `satisfies CollectionColumns<Row>` so a wrong key is an error.
- **`mobile` decides the phone row**: `primary` (first line), `accessory` (first line, right: a status), `meta` (the quiet second line), `hidden`. Give any column a role and the list is rows below 1024 px, a table above; give none and it stays a table.
- **A cell slot replaces a column's rendering**: `<template #cell-status="{ item, compact }">…</template>` (a dot in the key becomes `_`: `#cell-phase_label`). A slot that renders nothing shows nothing.
- **State is in the URL** (`state: { kind: "url", key: "query" }`): reload, back / forward and shared links restore page, sort, search and filters. Two lists on one page use two keys; `{ kind: "memory" }` keeps the state out of the URL (a list inside a dialog).
- **Rows open their record** through `recordRoute`, and the link carries the list's state (`?from=`), which is how the record page steps through the same list.
- **Filters** are descriptors: `select`, `text`, `segmented` or `range`; `placement: "panel"` moves one into the filter panel, `dependsOn` narrows one under another. **Views** (tabs with counts) and **saved views** are options of `useCollection` (`views`, `savedViews`).
- **Row actions**: `:row-actions="(row) => [{ key, label, icon, href | onSelect }]"` are swiped in on phones (links) and listed in the row's menu. `:row-label` names the row for the menu.
- **Page actions** are the actions the *user may use*: build the array from `access.can(...)`; the page decides where they render (a button in the toolbar, the phone bar's right side or its More menu).
- **An empty list** shows "nothing yet"; a search or filter that matched nothing shows the chips to remove, never "nothing yet". Put your own first-use content in the `#empty` slot.

## Two things it will not do

It does not hide a failed load behind an empty table: the failure is a banner with a retry, and the rows already shown stay. And it does not load more than one request at a time: a newer query drops the older answer.

A list that needs another layout composes the pieces itself: `AdaptivePageShell` from `@wssto2/vue-core/page` and `CollectionTable` from the collection entry, on the same `useCollection` handle.
