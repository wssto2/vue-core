# @wssto2/vue-core

The shared Vue 3 frontend library for go-core applications: the **app shell** (sidebar, top bar, phone drawer, account menu), **list**, **record** and **form** pages, and the controls they are made of. You write features (a typed list, a record, its routes and texts); the library writes the parts every screen repeats: loading, empty and error states, back-to-list, previous / next, section navigation, focus, keyboard, dark mode, reduced motion.

It is the extraction of the ARV frontend (design: "Emerald Native"). It has no business knowledge: permissions, menu destinations, icons and the user are **yours**, declared to the type system once.

Its plan and rules are in [PLAN.md](PLAN.md).

## What you get

| Import | For |
|---|---|
| `@wssto2/vue-core/platform` | `readBootstrap`, `createPlatform` (HTTP client, session, access), `AccessGate`, typed contexts |
| `@wssto2/vue-core/app` | `createApplication`, `defineFeature`, shell outlets, effects |
| `@wssto2/vue-core/shell` | `backofficeShell`, the shell's parts for a custom one |
| `@wssto2/vue-core/router` | `defineRoutes` (typed targets), guards, navigation |
| `@wssto2/vue-core/collection` | `defineCollection`, `useCollection`, `CollectionPage`, `DataTable` (a table over an array), record neighbors |
| `@wssto2/vue-core/resource`, `/page` | `useRouteResource`, `ResourcePage`, `SectionNavigator`, `AdaptivePageShell` |
| `@wssto2/vue-core/button`, `/controls`, `/content`, `/state`, `/overlay`, `/modal`, `/icon` | the primitives |
| `@wssto2/vue-core/i18n`, `/format`, `/client` | messages, `useDescribeError`, formatting, `HttpClient` and `ApiError` |
| `@wssto2/vue-core/identity`, `/access` | go-core's module contracts (types, route tables) and, in `/identity`, `identityFeature` (sign-in page, language), `identityPlatform()` and `usersFeature` (users, "my profile"): [sign-in](docs/recipes/sign-in.md), [users](docs/recipes/users.md) |
| `@wssto2/vue-core/access` (screens) | `accessFeature({ catalogue })`: roles list and editor, compare, replace, a person's roles (`PersonAccess`) and what they can do: [roles and access](docs/recipes/access.md) |
| `@wssto2/vue-core/testing` | `createTestPlatform`, `createTestApp`, fake transports: for your tests, [testing](docs/recipes/testing.md) |

Nothing is reachable by a deep import. The peers are `vue`, `vue-router` and `vue-i18n`; the library never bundles them.

## Install

```bash
npm install @wssto2/vue-core vue vue-router vue-i18n
npm install -D vite @vitejs/plugin-vue tailwindcss @tailwindcss/vite typescript vue-tsc
```

To try a change to the library in an app before it is released, build it and install the packed file: `npm run build && npm pack` here, then `npm install ../vue-core/wssto2-vue-core-<version>.tgz` in the app.

<!-- example: docs/examples/vite.config.ts -->
```ts
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// Vue's compiler and Tailwind v4's Vite plugin: the library ships no build setup of its own.
export default defineConfig({
  plugins: [vue(), tailwindcss()],
});
```

The page that hosts the app carries the server's public config, which the library reads once at startup:

```html
<body class="bg-surface-page text-content">
  <div id="app"></div>
  <script id="app-state" type="application/json">{ "locale": "en", "app_name": "Acme", "api_base": "/api/v1" }</script>
  <script type="module" src="/src/main.ts"></script>
</body>
```

## The composition root

One file knows every part of the application. `readBootstrap` validates the page's config, `createPlatform` builds the services everything shares (nothing runs yet), `createApplication` validates the whole composition (duplicate feature ids, route names, contexts, message namespaces, destinations, a missing login route) and throws one error listing every problem, then `mount` starts it.

<!-- example: docs/examples/app/main.ts -->
```ts
// The composition root: the one place that knows every part of the application.
import { createApplication } from "@wssto2/vue-core/app";
import { createPlatform, readBootstrap } from "@wssto2/vue-core/platform";
import { backofficeShell } from "@wssto2/vue-core/shell";
import { createAccountsFeature } from "../accounts/feature";
import { createTicketsFeature } from "../tickets/feature";
import { appIcons } from "./declarations";
import { sessionFeature } from "./session/feature";
import "./styles.css";

// 1. What the server embedded in the page (<script id="app-state" type="application/json">), validated once.
const config = readBootstrap();

// 2. The services every part shares: HTTP client, session, access. Nothing runs yet.
const platform = createPlatform({ config });

// 3. The application: an explicit list of features, and the shell around them.
const application = createApplication({
  platform,
  shell: backofficeShell(),
  icons: appIcons,
  features: [sessionFeature, createTicketsFeature(platform.http), createAccountsFeature(platform.http)],
});

void application.mount("#app");
```

Everything else an application sets (locales, persisting the locale, renewing a session, sign-out cleanup, error reporting) is in [app-setup](docs/recipes/app-setup.md). A second shell is in [shell](docs/recipes/shell.md).

## A feature

A feature is one value made by `defineFeature`: its routes, typed context, texts, navigation and whatever it contributes to the shell. Declaring it runs nothing; the application installs it.

<!-- example: docs/examples/tickets/feature.ts -->
```ts
import { defineFeature, provideContext } from "@wssto2/vue-core/app";
import type { HttpClient } from "@wssto2/vue-core/client";
import { localeMessages } from "@wssto2/vue-core/i18n";
import { createTicketsApi } from "./api";
import { createTicketList } from "./collection";
import { TICKETS } from "./context";
import { ticketRoutes } from "./routes";

// A feature is one value: what the application installs for it. Its collaborators are ordinary
// arguments, visible in the composition root.
export function createTicketsFeature(http: HttpClient) {
  const api = createTicketsApi(http);
  return defineFeature({
    id: "tickets",
    routes: ticketRoutes.records,
    context: provideContext(TICKETS, { api, list: createTicketList(api) }),
    // Loaded the first time a route of this feature is entered, in the active locale.
    messages: localeMessages("tickets", { en: () => import("./i18n/en.json"), hr: () => import("./i18n/hr.json") }),
    // The backend's menu names destinations; this says which route opens "tickets" and which records keep it highlighted.
    navigation: [{ destination: "tickets", to: ticketRoutes.index, within: ["tickets.record"] }],
  });
}
```

Its routes are declared once and used as typed targets. A route with parameters is a function of them; a missing or wrong one does not compile:

<!-- example: docs/examples/tickets/routes.ts -->
```ts
import { defineRoutes } from "@wssto2/vue-core/router";

export const ticketRoutes = defineRoutes({
  index: {
    name: "tickets.index",
    path: "/tickets",
    component: () => import("./views/Index.vue"),
    meta: { access: "tickets:view", titleKey: "tickets.title" },
  },
  record: {
    name: "tickets.record",
    path: "/tickets/:ticketID",
    component: () => import("./views/Record.vue"),
    meta: { access: "tickets:view", titleKey: "tickets.title", remountOnParam: "ticketID" },
  },
});

// ticketRoutes.index                      a route without parameters is a value
// ticketRoutes.record({ ticketID: 12 })   one with parameters is a function; a wrong or missing one does not compile
```

What its views need (the API, the list definition) comes through a typed context, not a global. `useTickets()` throws a message naming the missing feature if it is not installed:

<!-- example: docs/examples/tickets/context.ts -->
```ts
import { defineFeatureContext } from "@wssto2/vue-core/platform";
import type { TicketsApi } from "./api";
import type { createTicketList } from "./collection";

export interface TicketsDependencies {
  readonly api: TicketsApi;
  readonly list: ReturnType<typeof createTicketList>;
}

// A typed key: `useTickets()` fails with a clear message when the feature is not installed.
export const [TICKETS, useTickets] = defineFeatureContext<TicketsDependencies>("tickets");
```

Its texts are JSON files under the feature, loaded the first time one of its routes is entered, in the active locale:

<!-- example: docs/examples/tickets/i18n/en.json -->
```json
{
  "title": "Tickets",
  "description": "Everything customers asked for",
  "create": "New ticket",
  "subject": "Subject",
  "status": "Status",
  "assignee": "Assignee",
  "created": "Created",
  "open": "Open",
  "closed": "Closed",
  "record": "Ticket",
  "details": "Details",
  "history": "History",
  "history_empty": "Nothing has happened yet.",
  "when": "When",
  "kind": "Kind",
  "author": "Author",
  "note": "Note",
  "comment": "Comment",
  "change": "Status change",
  "remove": "Remove"
}
```

The views are [a list page](docs/recipes/list-page.md) and [a record page](docs/recipes/record-page.md).

## Typed routes

go-core's generator writes one `route<In, Out>(method, path, options?)` per endpoint; `client.request(route, input)` calls it with the input and the answer typed. Details, a list from a route and the errors: [typed routes](docs/recipes/typed-routes.md).

<!-- example: docs/examples/routes/api.ts:1-11 -->
```ts
import { createHttpClient, isApiError } from "@wssto2/vue-core/client";
import { ticketsRoutes } from "./routes";
import { route } from "@wssto2/vue-core/client";

const http = createHttpClient({ baseUrl: "/api" });

// A path parameter and the rest as the query: GET /api/v1/tickets/7
export async function loadTicket(id: number, signal: AbortSignal) {
  const result = await http.request(ticketsRoutes.show, { id }, { signal });
  return result.data; // typed as Ticket
}
```

## Permissions, destinations and icons

The library knows none of your permissions, none of your backend's menu destinations and none of your icons. You declare them by merging into three interfaces, like vue-router's `RouteMeta`; after that a typo in `meta.access`, in a navigation binding or in `<Icon name>` is a compile error:

<!-- example: docs/examples/app/declarations.ts -->
```ts
// What the application tells the types about itself: its permissions, the destinations of its
// backend's menu and its icons. Declaration merging, like vue-router's `RouteMeta`: a permission,
// destination or icon that is not declared here is a compile error where it is used.
import type { IconSet } from "@wssto2/vue-core/icon";

declare module "@wssto2/vue-core/platform" {
  interface PermissionRegistry {
    "tickets:view": true;
    "tickets:update": true;
    "accounts:view": true;
    // go-core's access module defines these in the catalogue, so a generated union has them (the roles screens name them).
    "iam.role:view": true;
    "iam.role:manage": true;
    "iam.role:delete": true;
    "iam.user:view": true;
    "iam.user:manage": true;
  }
}

declare module "@wssto2/vue-core/router" {
  interface DestinationRegistry {
    tickets: true;
    accounts: true;
    users: true;
    "iam.roles": true;
  }
}

declare module "@wssto2/vue-core/icon" {
  interface IconRegistry {
    ticketLine: true;
  }
}

/** The SVG sources of the declared icons (here Remix Icon's "coupon"); a feature may bring its own set. */
export const appIcons = {
  ticketLine:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3C21.5523 3 22 3.44772 22 4V9.5C20.6193 9.5 19.5 10.6193 19.5 12C19.5 13.3807 20.6193 14.5 22 14.5V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V14.5C3.38071 14.5 4.5 13.3807 4.5 12C4.5 10.6193 3.38071 9.5 2 9.5V4C2 3.44772 2.44772 3 3 3H21ZM20 5H4V7.8C5.6 8.6 6.5 10.2 6.5 12C6.5 13.8 5.6 15.4 4 16.2V19H20V16.2C18.4 15.4 17.5 13.8 17.5 12C17.5 10.2 18.4 8.6 20 7.8V5Z"></path></svg>',
} satisfies IconSet;
```

`access: "tickets:view"` on a route hides the page from anyone without it (a denied address shows a no-access page, live on permission refresh); `access.can("tickets:update")` decides what a component offers. A route's `meta.access` also accepts `{ any: [...] }` and `{ all: [...] }`. The navigation the server sends names destinations (`tickets`); a feature's `navigation` binds each to a route.

Icons are SVG sources keyed by name. `icons` takes one set or several partial ones (a feature may bring its own; a name in two sets is an error). The library's own icons (`close`, `search`, `arrowLeftSLine`...) need no registration.

## Styles

The library is styled with Tailwind v4 through semantic tokens (`bg-surface-page`, `text-content-muted`, `rounded-group`...). Your app runs its own Tailwind and imports the library's tokens, variants and fonts after it; the library's own utilities are generated from its built package (`tailwind.css` does the `@source`), so there is one CSS build:

<!-- example: docs/examples/app/styles.css -->
```css
@import "tailwindcss";
@import "@wssto2/vue-core/tailwind.css";
@import "@wssto2/vue-core/fonts.css";
@import "./brand.css";
```

The brand accent is a handful of variables you redefine after the import (light on `:root`, dark on `.dark`):

<!-- example: docs/examples/app/brand.css -->
```css
/* The brand accent: the palettes and the "Accent" variables of the library's theme.css, redefined
   after it (light on :root, dark on .dark). Status colours never follow the brand. */
:root {
  --color-primary-50: #EFF6FF;
  --color-primary-100: #DBEAFE;
  --color-primary-200: #BFDBFE;
  --color-primary-300: #93C5FD;
  --color-primary-400: #60A5FA;
  --color-primary-500: #3B82F6;
  --color-primary-600: #2563EB;
  --color-primary-700: #1D4ED8;
  --color-primary-800: #1E40AF;
  --color-primary-900: #1E3A8A;
  --color-primary-950: #172554;
  --color-anchor-800: #1B2A4A;
  --color-anchor-900: #111C33;
  --color-anchor-950: #0A1222;

  --app-tint: #1D4ED8;
  --app-tint-soft: #E8EFFD;
  --app-control-on: #2563EB;
  --app-tile-brand: #2563EB;
  --app-tile-anchor: #1B2A4A;
  --app-tile-anchor-foreground: #93C5FD;
  --app-content-inverse-accent: #93C5FD;
}

.dark {
  --app-tint: #60A5FA;
  --app-tint-soft: #1B2A4A;
  --app-control-on: #3B82F6;
  --app-content-on-tint: #0A1222;
  --app-tile-anchor: #22335C;
  --app-content-inverse-accent: #1D4ED8;
}
```

Dark mode is the `dark` class on `<html>`; nothing is decided for you. An app that does not write Tailwind utilities imports the prebuilt `@wssto2/vue-core/styles.css` instead. More in [theming](docs/recipes/theming.md).

## Texts and locales

The library's own texts are under the `core` namespace in English, Croatian, Bosnian and Slovenian (`t("core.actions.cancel")`). `createApplication` merges them into its vue-i18n instance; override any key with `i18n.messages` and restrict the offered locales with `locale.supported`. A feature's texts are a namespace (`localeMessages("tickets", { en: () => import("./i18n/en.json") })`, used as `t("tickets.title")`) loaded per locale on demand. A locale switch (the account menu has one) loads every namespace in use first, so nothing shows a raw key; `locale.onChange` lets you save the choice on the user.

## Recipes

- [List page](docs/recipes/list-page.md): a typed collection, columns, filters, row actions, URL state; a table over an array
- [Record page](docs/recipes/record-page.md): a simple record, a record with sections, regions that load on their own (`useResource`, `useLoad`), previous / next
- [Shell](docs/recipes/shell.md): the default shell, contributions from features, keyboard shortcuts and their help, running inside a frame, a custom shell
- [App setup](docs/recipes/app-setup.md): config, session, effects, locales and flags, permissions in the UI, error sentences, startup errors
- [Forms](docs/recipes/forms.md): form state, fields, a record edited in group sheets, a long form, commands
- [Typed routes](docs/recipes/typed-routes.md): generated routes, `client.request`, a list from a route
- [Sign-in](docs/recipes/sign-in.md): go-core's identity module: the sign-in page, the session wiring, the language, the module's committed types, the dev server
- [Users and profile](docs/recipes/users.md): the users list and a person's record, "my profile" with the e-mail change by code, opting out, extra sections, refusals
- [Roles and access](docs/recipes/access.md): go-core's access module: the roles list and editor from your catalogue, a person's roles and effective access, where a role applies, the refusals
- [Theming](docs/recipes/theming.md): brand accent, dark mode, tokens, status tones and category hues
- [Testing](docs/recipes/testing.md): the application's environment and a fake backend for your tests

Forms have their own recipe when that phase lands.

## Working on the library

```bash
npm run check   # lint, typecheck (src and the documented examples), docs = examples, tests, build, packed-consumer check
```

The code in this README and in the recipes is copied from [docs/examples](docs/examples), which `npm run typecheck:docs` compiles against the library's sources and `npm run check:docs` compares with the documents. Change an example, then paste it again.
