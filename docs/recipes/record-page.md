# Recipe: a record page

A record page is **a resource** (one record, read by the route's id) inside **`<ResourcePage>`**. The resource handles the id, the read, stale answers and "not found"; the page handles the title, back, the loading / failed / not-found states and the pager. You write what the record looks like.

## 1. A simple record

<!-- example: docs/examples/tickets/views/Record.vue -->
```vue
<script setup lang="ts">
import { useCollectionNeighbors } from "@wssto2/vue-core/collection";
import { KeyValueList, Panel } from "@wssto2/vue-core/content";
import { ResourcePage, useRouteResource } from "@wssto2/vue-core/resource";
import { useI18n } from "vue-i18n";
import { useTickets } from "../context";
import { ticketRoutes } from "../routes";

const { t } = useI18n();
const { api, list } = useTickets();

// The record of the route's `:ticketID`: loaded on its own, a newer navigation drops an older answer.
const ticket = useRouteResource({ param: "ticketID", load: (id, { signal }) => api.get(id, signal) });

// Opened from the list? Then "back" returns to it with its state, and previous / next step through
// the same query (J / K and the arrows too). Opened by a direct link: back goes to the plain list.
const neighbors = useCollectionNeighbors(list, { current: () => ticket.id.value, list: ticketRoutes.index, param: "ticketID", backLabel: () => t("tickets.title") });
</script>

<template>
  <ResourcePage :resource="ticket" :title="ticket.data.value?.subject ?? t('tickets.record')" :list="neighbors.context">
    <template #default="{ record }">
      <Panel :title="t('tickets.details')">
        <KeyValueList
          :items="[
            { key: 'status', label: t('tickets.status'), value: t(`tickets.${record.status}`) },
            { key: 'assignee', label: t('tickets.assignee'), value: record.assignee },
          ]" />
      </Panel>
    </template>
  </ResourcePage>
</template>
```

- `useRouteResource({ param, load })` reads the route's parameter (a positive integer by default; pass `parse` for another kind of id), loads on every change of it, drops an older answer when the user pages on, and exposes `data`, `state`, `id`, `reload()` and `update(saved)` (put a save's answer in place; an answer for another record is ignored).
- `ResourcePage` renders the slot with the loaded record, **non-null**. Before that it shows the plain title and a skeleton; a failed read is an error with a retry; a missing record (404 or an invalid address) is a not-found state, never a retry.
- `title` is the large title, the phone bar's title and the browser tab's: pass the record's name once loaded, a fixed word before.
- **Back and previous / next.** `useCollectionNeighbors` replays the list's state (`?from=`) through the same definition and gives the page `context`: `back` leads to the list as the user left it (the plain list for a direct link), and once the record's place in the list is known the page shows one pager, "12 / 286" with previous and next. J / K and the arrow keys step too, except while typing in a field. For a record that is not opened from a list, pass `:back="{ label, to }"` instead.
- Put a `#header` slot (a `RecordHeader` with an avatar or icon tile, meta and quick actions) on it when the record deserves one.

## 2. A record with sections

Sections are **child routes with `meta.section`**. The page's navigator lists them: a source list beside the content on desktop, drill-in rows on a phone. The bare record URL has no section of its own; the navigator moves it to the first section the user may open, and leaves out any section whose `access` they lack.

<!-- example: docs/examples/accounts/routes.ts -->
```ts
import { defineRoutes } from "@wssto2/vue-core/router";

// The sections of a record are its children with `meta.section`; the page's navigator lists them. The bare URL has
// no section of its own: the navigator moves it to the first section the user may open. `meta.access` on a
// child hides that section from the ones who may not open it.
export const accountRoutes = defineRoutes({
  record: {
    name: "accounts.record",
    path: "/accounts/:accountID",
    component: () => import("./views/Record.vue"),
    meta: { access: "accounts:view", titleKey: "accounts.title", remountOnParam: "accountID" },
    children: [
      { name: "accounts.record.general", path: "general", component: () => import("./views/General.vue"), meta: { section: { labelKey: "accounts.sections.general", icon: "informationLine" } } },
      { name: "accounts.record.activity", path: "activity", component: () => import("./views/Activity.vue"), meta: { section: { labelKey: "accounts.sections.activity", icon: "refreshLine" } } },
    ],
  },
});
```

The record page loads the record once, **provides it** to its sections with a typed key, and renders the sections in the navigator's body:

<!-- example: docs/examples/accounts/views/Record.vue -->
```vue
<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { IconTile } from "@wssto2/vue-core/controls";
import { RecordHeader, SectionNavigator } from "@wssto2/vue-core/page";
import { ResourcePage, useRouteResource } from "@wssto2/vue-core/resource";
import { AppRouterView } from "@wssto2/vue-core/router";
import { Badge } from "@wssto2/vue-core/state";
import { useAccountsApi, ACCOUNT } from "../context";

const { t } = useI18n();
const api = useAccountsApi();

// `key` provides the resource to the routed sections below (they read it with useRouteResourceContext).
const account = useRouteResource({ key: ACCOUNT, param: "accountID", load: (id, { signal }) => api.get(id, signal) });
const title = computed(() => account.data.value?.name ?? t("accounts.record"));
</script>

<template>
  <ResourcePage :resource="account" :title="title" :back="{ label: t('accounts.title'), to: '/' }">
    <template #header="{ record }">
      <RecordHeader :title="record.name" :subtitle="record.plan">
        <template #leading><IconTile icon="ticketLine" size="lg" /></template>
        <template #meta><Badge :tone="record.active ? 'positive' : 'neutral'" dot>{{ t(record.active ? "accounts.active" : "accounts.inactive") }}</Badge></template>
      </RecordHeader>
    </template>
    <template #default="{ record }">
      <!-- The sections of the route, as a source list beside the content on desktop and drill-in rows on a phone. -->
      <SectionNavigator :label="t('accounts.sections.label')" desktop="sidebar" compact="rows" :back-label="record.name">
        <AppRouterView />
      </SectionNavigator>
    </template>
  </ResourcePage>
</template>
```

A section is an ordinary route component that reads the page's record from the key and loads nothing itself:

<!-- example: docs/examples/accounts/context.ts -->
```ts
import type { InjectionKey } from "vue";
import { defineFeatureContext } from "@wssto2/vue-core/platform";
import type { RouteResource } from "@wssto2/vue-core/resource";
import type { Account, AccountsApi } from "./api";

// The record, shared with its routed sections: the page provides it, each section reads it with `useRouteResourceContext(ACCOUNT)`.
export const ACCOUNT: InjectionKey<RouteResource<Account>> = Symbol("accounts.record");

export const [ACCOUNTS_API, useAccountsApi] = defineFeatureContext<AccountsApi>("accounts.api");
```

<!-- example: docs/examples/accounts/views/General.vue -->
```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { KeyValueList, Panel } from "@wssto2/vue-core/content";
import { useRouteResourceContext } from "@wssto2/vue-core/resource";
import { ACCOUNT } from "../context";

const { t } = useI18n();
const account = useRouteResourceContext(ACCOUNT); // the page's record: the section loads nothing
</script>

<template>
  <Panel v-if="account.data.value" :title="t('accounts.sections.general')">
    <KeyValueList :items="[{ key: 'plan', label: t('accounts.plan'), value: account.data.value.plan }]" />
  </Panel>
</template>
```

`SectionNavigator` also has `desktop="segments"` (a segmented control above the content) and `compact="segmented"`. Pass `counts` to show a quiet count per section.

## 3. Regions that load on their own

A part of the record with a read of its own (history, comments, related rows) is `useResource({ for: record, load })`. It **waits until the record is loaded**, loads with the record's id, reloads when that changes, and fails and retries by itself. A missing record is therefore one not-found state, not one per region, and a failing region never blanks the record:

<!-- example: docs/examples/accounts/views/Activity.vue -->
```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Panel } from "@wssto2/vue-core/content";
import { useResource, useRouteResourceContext } from "@wssto2/vue-core/resource";
import { AsyncSection } from "@wssto2/vue-core/state";
import { ACCOUNT, useAccountsApi } from "../context";

const { t } = useI18n();
const api = useAccountsApi();
const account = useRouteResourceContext(ACCOUNT);

// A region with a read of its own, depending on the record: it waits until the account is loaded (a missing
// account is one not-found state, not one per region), loads with its id, and retries on its own.
const activity = useResource({ for: account, load: (id, { signal }) => api.activity(id, signal) });
</script>

<template>
  <Panel :title="t('accounts.sections.activity')">
    <AsyncSection :state="activity.state.value" :empty-title="t('accounts.activity.empty')" @retry="activity.reload()">
      <template #default="{ value }">
        <ul class="flex flex-col gap-2">
          <li v-for="entry in value" :key="entry.id">{{ entry.text }}</li>
        </ul>
      </template>
    </AsyncSection>
  </Panel>
</template>
```

`AsyncSection` is the region's frame: a skeleton while loading, the error with a retry, the empty state, and the value (non-null) once loaded, kept on screen while it refreshes.

## 4. A layout of your own

When the record is not "header, then content" (a lead with a phase track, a contact panel, comments beside sections), compose the same parts: `AdaptivePageShell` for the chrome, `RecordHeader`, `SectionNavigator` anywhere in your grid, and the same resource. The playground's lead page does this and is the reference: `playground/src/app/features/records/views/LeadRecord.vue`. Its pager is `RecordPager` (from `@wssto2/vue-core/resource`) in the shell's `#pager` slot, fed by `neighbors.context.neighbors`.
