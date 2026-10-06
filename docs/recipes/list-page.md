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
- **A row's leading mark** goes in the `#leading` slot (a column of the table, the left of the phone row) and is quiet: `<template #leading="{ item }"><IconTile weight="soft" size="sm" icon="user3Line" /></template>`, a 32 px light tint with the tone's glyph. The default `solid` weight is for headers and navigation, where a block of colour belongs; in a row it reads as a missing photo.
- **A cell slot replaces a column's rendering**: `<template #cell-status="{ item, compact }">…</template>` (a dot in the key becomes `_`: `#cell-phase_label`). A slot that renders nothing shows nothing.
- **State is in the URL** (`state: { kind: "url", key: "query" }`): reload, back / forward and shared links restore page, sort, search and filters. Two lists on one page use two keys; `{ kind: "memory" }` keeps the state out of the URL (a list inside a dialog).
- **Rows open their record** through `recordRoute`, and the link carries the list's state (`?from=`), which is how the record page steps through the same list.
- **Filters** are descriptors: `select`, `text`, `segmented` or `range`; an option that is a state carries `dot: "positive"` (any tone: a small status dot before its label in the menu, the sheet and the applied capsule, never HTML); `placement: "panel"` moves one into the filter panel, `dependsOn` narrows one under another. **Views** (tabs with counts) and **saved views** are options of `useCollection` (`views`, `savedViews`).
- **Row actions**: `:row-actions="(row) => [{ key, label, icon, href | onSelect }]"` are swiped in on phones (links) and listed in the row's menu. `:row-label` names the row for the menu.
- **Page actions** are the actions the *user may use*: build the array from `access.can(...)`; the page decides where they render (a button in the toolbar, the phone bar's right side or its More menu).
- **An empty list** shows "nothing yet"; a search or filter that matched nothing shows the chips to remove, never "nothing yet". Put your own first-use content in the `#empty` slot.

## A table over an array

Not every table is a list. A child table on a record page, a summary on a dashboard, the lines of an order: the rows are already in hand, there is nothing to fetch, page, search or keep in the URL. `DataTable` is that table: the collection's columns, cells, phone rows and row actions over a `rows` array, without the collection.

<!-- example: docs/examples/tickets/components/TicketHistory.vue -->
```vue
<script setup lang="ts">
import { DataTable, RowActions, type RowAction, type TableColumns } from "@wssto2/vue-core/collection";
import { Panel } from "@wssto2/vue-core/content";
import { toast } from "@wssto2/vue-core/overlay";
import { usePlatform } from "@wssto2/vue-core/platform";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

interface TicketEvent {
  readonly id: number;
  readonly at: string;
  readonly kind: "comment" | "change";
  readonly author: string;
  readonly note: string;
}

// The array is already on the page (the record carries it): no loader, no paging, no URL state.
defineProps<{ events: readonly TicketEvent[] }>();

const { t } = useI18n();
const { access } = usePlatform();

// The collection's columns, without sorting: the table keeps the order it was given.
const columns = computed(() => [
  { key: "at", label: t("tickets.when"), kind: "timestamp", width: 170, mobile: "meta" },
  { key: "kind", label: t("tickets.kind"), kind: "badge", tone: (event: TicketEvent) => (event.kind === "change" ? "info" : "neutral"), text: (event: TicketEvent) => t(`tickets.${event.kind}`), mobile: "accessory" },
  { key: "author", label: t("tickets.author"), hideBelow: "md", mobile: "meta" },
  { key: "note", label: t("tickets.note"), mobile: "primary" },
] satisfies TableColumns<TicketEvent>);

// Only what the user may do; the same array feeds the buttons, the phone row's swipe and the context menu.
const actionsOf = (event: TicketEvent): RowAction[] =>
  access.can("tickets:update") ? [{ key: "remove", label: t("tickets.remove"), icon: "deleteBin2Line", tone: "critical", onSelect: () => toast.info(`${t("tickets.remove")} #${event.id}`) }] : [];
</script>

<template>
  <Panel :title="t('tickets.history')" flush>
    <DataTable :rows="events" :columns="columns" :row-key="(event) => event.id" density="condensed" :row-actions="actionsOf" :row-label="(event) => event.note">
      <!-- A cell slot replaces a column's rendering; `item` is a TicketEvent, `compact` is true in the phone row. -->
      <template #cell-note="{ item, compact }"><span :class="compact ? 'text-row-title' : ''">{{ item.note }}</span></template>
      <template #actions="{ item }"><RowActions :actions="actionsOf(item)" /></template>
      <template #empty>{{ t("tickets.history_empty") }}</template>
    </DataTable>
  </Panel>
</template>
```

What to know:

- **Same columns as a list.** `kind`, `align`, `width`, `hideBelow`, `mobile` roles and typed `#cell-<key>` slots work as above; write the array with `satisfies TableColumns<Row>`. The one difference: no `sort` key (a table over an array keeps the order it was given; sort the array).
- **No card of its own.** It is the table (and below 1024 px, with `mobile` roles, the phone rows); put it in a `Panel` (`flush`), a grouped section or a dialog.
- **`loading`** shows skeleton rows (`skeleton-rows`, default 3) instead of the rows; no rows shows "No data", or your `#empty` content.
- **Row actions are one array, written once.** `:row-actions` feeds the swipe, the context menu and the More button, as on a list. For visible icon buttons in the desktop actions cell, fill the `#actions` slot with `<RowActions :actions="…" />` (a link is an anchor, a command a button, `critical` is red); `:disabled` greys them out for a locked row. Build the array from `access.can(...)`: there is no permission prop to hide actions.
- **`recordRoute`** makes a row open its record on click and an `identity` column link to it (without the `?from=` state a list adds). `row-class` marks a row (a total, the newest), `density="condensed"` tightens the cells.
- `RowActions` and the `#actions` slot work on `CollectionTable` too, where they replace the default open-record link and More button.

## Two things it will not do

It does not hide a failed load behind an empty table: the failure is a banner with a retry, and the rows already shown stay. And it does not load more than one request at a time: a newer query drops the older answer.

A list that needs another layout composes the pieces itself: `AdaptivePageShell` from `@wssto2/vue-core/page` and `CollectionTable` from the collection entry, on the same `useCollection` handle.
