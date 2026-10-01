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

### A region with nothing to be identified by

A list, a page's settings or a block that is not about this record has no id to wait for: `useLoad(({ signal }) => …)` is the same region without one. The latest load wins (an older one is aborted and its answer dropped), `reload()` keeps the rows on screen while it runs, `update(value)` puts in what a save returned and counts as the latest result (a reload that started before it cannot bring the older state back), and nothing lands after the page is left. Its `state` is the `AsyncState` that `AsyncSection` takes.

<!-- example: docs/examples/accounts/components/Plans.vue -->
```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Panel } from "@wssto2/vue-core/content";
import { usePlatform } from "@wssto2/vue-core/platform";
import { AsyncSection, useLoad } from "@wssto2/vue-core/state";

interface Plan {
  readonly id: number;
  readonly name: string;
}

const { t } = useI18n();
const { http } = usePlatform();

// A region with nothing to be identified by (a list, a page's settings): one load, latest wins, and the state
// is the same AsyncState the frame takes. `reload()` keeps the rows on screen while it runs; `plans.update(rows)`
// puts in what a save returned and drops any load still on its way.
const plans = useLoad(({ signal }) => http.get<Plan[]>("/plans", { signal }).then((result) => result.data));
</script>

<template>
  <Panel :title="t('accounts.plans')">
    <AsyncSection :state="plans.state.value" @retry="plans.reload()">
      <template #default="{ value }">
        <ul class="flex flex-col gap-2">
          <li v-for="plan in value" :key="plan.id">{{ plan.name }}</li>
        </ul>
      </template>
    </AsyncSection>
  </Panel>
</template>
```

`useLoad(load, { watch })` starts over from nothing when a source changes (a route parameter, a selected tab); `{ immediate: false }` waits for `reload()`. A failure is worded by `describeError` (see [app setup](app-setup.md)) unless you pass `errorMessage`.

## 4. A layout of your own

When the record is not "header, then content" (a lead with a phase track, a contact panel, comments beside sections), compose the same parts: `AdaptivePageShell` for the chrome, `RecordHeader`, `SectionNavigator` anywhere in your grid, and the same resource. The playground's lead page does this and is the reference: `playground/src/app/features/records/views/LeadRecord.vue`. Its pager is `RecordPager` (from `@wssto2/vue-core/resource`) in the shell's `#pager` slot, fed by `neighbors.context.neighbors`.

## 5. A workflow record, and the photo viewer

Some records are not read but **worked through**: an appraisal goes over days, several people take part, the steps can be done in any order. That is not a wizard (a step form is for one sitting). Give `SectionNavigator` a `steps` object and the sections become large tiles: the step's number or a ✓ once done, its label, **one line saying where it stands** in a tone, and the step you are on tinted. They are links, so any step opens at any time.

<!-- example: docs/examples/accounts/views/Onboarding.vue:10-17 -->
```ts
// A record that is worked on over days, by several people, in any order: each section is a step with one line saying where it
// stands. The keys are the sections' route names; a section without an entry is simply not done and has no line.
const steps = computed<Record<string, SectionStep>>(() => ({
  "accounts.onboarding.profile": props.profileDone ? { done: true, sub: t("accounts.onboarding.complete") } : { done: false, sub: t("accounts.onboarding.profileOpen") },
  "accounts.onboarding.documents": props.missing.length > 0
    ? { done: false, sub: t("accounts.onboarding.missing", { what: props.missing.join(", ") }), shortSub: t("accounts.onboarding.missingShort"), tone: "warning" }
    : { done: true, sub: t("accounts.onboarding.documentsCount", { count: props.documents }) },
}));
```

<!-- example: docs/examples/accounts/views/Onboarding.vue:20-24 -->
```vue
<template>
  <SectionNavigator :label="t('accounts.onboarding.label')" :steps="steps">
    <AppRouterView />
  </SectionNavigator>
</template>
```

The routes are the same child routes with `meta.section` as in section 2; `steps` is keyed by their names. The line is the page's to compute from its record (from a derived workflow read model, ideally: the server knows what is missing), so the tile and the data never disagree. `tone` is `positive`, `warning` or `critical`; `shortSub` is the line on phones when `sub` is too long for a tile. The tiles are the navigation on every width (`desktop` and `compact` do not apply), with the short label on phones. A long form inside a step lists its own sections (`SectionPanel`) beside it on wide screens and in the floating jumper on phones, as it does under the other variants.

### Photographs

`PhotoViewer` (in `@wssto2/vue-core/overlay`) is a full-screen dark viewer for a set of pictures: zoom (buttons, wheel, pinch, double tap or double click, 100 to 500 %), drag a zoomed picture with a mini-map showing where you are, rotate, download, previous and next (buttons, swipe, arrow keys) and a strip of thumbnails. It is a dialog like `Modal`: the page behind is inert, Tab stays inside, Escape closes and focus goes back to what opened it; under reduced motion nothing animates. Keys: ← → pictures, + − zoom, 0 fits the screen again, R rotates, Esc closes. `PhotoField` opens it when its picture is tapped; for a gallery you give it typed items and call `present(index)`:

<!-- example: docs/examples/accounts/components/Gallery.vue:11-12 -->
```ts
// Typed items: the picture, an optional small one for the strip, what it shows, the file name Download suggests.
const items = (): PhotoViewerItem[] => props.photos.map((photo) => ({ src: photo.url, thumb: photo.small, alt: photo.caption, downloadName: `${photo.caption}.jpg` }));
```

<!-- example: docs/examples/accounts/components/Gallery.vue:16-27 -->
```vue
<template>
  <ul class="grid grid-cols-4 gap-2">
    <li v-for="(photo, at) in props.photos" :key="photo.id">
      <button type="button" :aria-label="photo.caption" @click="viewer?.present(at)"><img :src="photo.small" alt="" class="aspect-8/5 w-full object-cover" /></button>
    </li>
  </ul>

  <PhotoViewer ref="viewer" :items="items()" :title="t('accounts.photos')">
    <!-- Your own buttons next to zoom, rotate and download, given the photo on show. -->
    <template #actions="{ index }"><Button prominence="plain" @click="emit('makeCover', props.photos[index]!.id)">{{ t("accounts.makeCover") }}</Button></template>
  </PhotoViewer>
</template>
```

`#actions` puts your own buttons (make it the cover, delete it) next to zoom, rotate and download, given the picture on show. The pictures are the app's: the viewer loads `src` as an image, never as markup, and Download only keeps `downloadName` for a picture served from this origin.

