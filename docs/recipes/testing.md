# Recipe: testing

`@wssto2/vue-core/testing` builds the environment your components run in (platform, router, i18n, formatting) and fakes the backend, so a test mounts a real page and asserts on what the user sees. It brings no test runner and no testing library: you install `vitest` and `@testing-library/vue` (or `@vue/test-utils`), and hand them what this builds. Import it from test files only; no other part of the package imports it.

| | |
|---|---|
| `createTestPlatform({ user, permissions, transport })` | The platform: an HTTP client over a fake transport, a session that is already signed in (no request) and the access it grants. `user: null` is nobody signed in; `unavailable`, `root`, `config`, `renewSession`, `onSessionExpired` and the other platform options pass through. |
| `createTestApp({ platform, routes, location, messages, locale, plugins })` | What a component needs around it: `app.plugins` (router, vue-i18n with the library's texts and yours, formatting, the platform), and `app.platform`, `app.router`, `app.i18n`. |
| `withSetup(composable, app?)` | Runs a composable inside a mounted component of that environment. |
| `scriptedTransport(...answers)` / `routedTransport({ "GET /path": answer })` | The fake backend: answers in order, or by method and path. Both record `calls`. An unanswered request fails the test and names itself. |
| `jsonResponse(status, body)` | A JSON answer, as go-core sends it. |
| `fakeLoader(answer)` / `listPage(rows)` | A collection loader that records the queries it was asked, and a page of rows for it to return. |
| `createTestSession(...)`, `heldAccess(level, id, qualifier)` | A session snapshot (`session.establish(...)` mid-test) and a scoped grant for `permissions`. |
| `createTestI18n({ locale, messages })`, `stubRoutes(records)` | The pieces of `createTestApp` on their own: i18n with your texts over the library's, and your real routes with empty pages. |
| `settle()`, `deferred()`, `mockMedia({ compact, narrow, reducedMotion, standalone })` | Let timers, navigation and the update queue run; settle a promise by hand; fake `matchMedia` for the phone layout. |

## Setup

Vitest needs Vue's compiler and a DOM; nothing else:

<!-- example: docs/examples/vitest.config.ts -->
```ts
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

// What the tests need from the application's build setup: Vue's compiler for `.vue` files and a DOM.
// `@wssto2/vue-core/testing` brings no test runner and no testing library: install vitest and
// @testing-library/vue (or @vue/test-utils) yourself.
export default defineConfig({
  plugins: [vue()],
  test: { environment: "happy-dom" },
});
```

## A page

The page runs as in the application: its feature's context, its texts, its routes (the real names, empty pages), the user's permissions, and a backend that answers by route. Nothing is mocked, so the test fails when the page asks for something the backend does not answer, and the permission test is the permission the page really checks.

<!-- example: docs/examples/tickets/tests/Index.test.ts -->
```ts
import { render, screen } from "@testing-library/vue";
import { createTestApp, createTestPlatform, jsonResponse, routedTransport, settle, stubRoutes } from "@wssto2/vue-core/testing";
import { describe, expect, it } from "vitest";
import { createTicketsApi } from "../api";
import { createTicketList } from "../collection";
import { TICKETS } from "../context";
import en from "../i18n/en.json";
import { ticketRoutes } from "../routes";
import Index from "../views/Index.vue";

const ticket = { id: 1, subject: "Printer is on fire", status: "open", assignee: "Ana", created_at: "2026-09-30T08:00:00Z" };

// The page as the application runs it, around a backend answering by route: no mocked modules.
function mountIndex(permissions: string[]) {
  const { transport, calls } = routedTransport({
    "GET /tickets": jsonResponse(200, { success: true, data: [ticket], meta: { total: 1, page: 1, per_page: 25, last_page: 1, from: 1, to: 1 } }),
  });
  const platform = createTestPlatform({ permissions, transport });
  const api = createTicketsApi(platform.http);
  const app = createTestApp({
    platform,
    routes: stubRoutes(ticketRoutes.records), // the real route names, empty pages
    location: "/tickets",
    messages: { en: { tickets: en } },
    plugins: [{ install: (instance) => instance.provide(TICKETS, { api, list: createTicketList(api) }) }],
  });
  render(Index, { global: { plugins: [...app.plugins] } });
  return { calls, router: app.router };
}

describe("the ticket list", () => {
  it("shows what the backend sent, each ticket linking to its record", async () => {
    const { calls } = mountIndex(["tickets:view"]);
    await settle();
    expect(screen.getByRole("link", { name: "Printer is on fire" }).getAttribute("href")).toMatch(/^\/tickets\/1\?from=/); // the link carries the list's state
    expect(calls[0]?.url).toContain("order_col=created_at"); // what the list asked for: its default sort
  });

  it("offers to create a ticket only to whoever may", async () => {
    mountIndex(["tickets:view"]);
    await settle();
    expect(screen.queryByRole("button", { name: "New ticket" })).toBeNull();
  });

  it("offers it to a user holding the permission", async () => {
    mountIndex(["tickets:view", "tickets:update"]);
    await settle();
    expect(screen.getAllByRole("button", { name: "New ticket" }).length).toBeGreaterThan(0);
  });
});
```

- `createTestApp` returns `plugins` rather than mounting, so it works with whatever mounts for you: `render(Page, { global: { plugins: [...app.plugins] } })` of @testing-library/vue, or `mount(Page, { global: { plugins: [...app.plugins] } })` of @vue/test-utils.
- The router starts at `location` once it is installed: `await app.router.isReady()` before asserting on what a route renders, `await app.router.push(...)` to go somewhere else.
- A feature's context is one line: `plugins: [{ install: (instance) => instance.provide(KEY, value) }]`.
- `messages` are merged over the library's texts per locale, yours winning, so a button reads in the test what it reads in production (`getByRole("button", { name: "New ticket" })`).

## A component, and who may do what

A component that asks `access.can(...)` is tested by the platform it gets: build one per case. The phone layout is `mockMedia`:

<!-- example: docs/examples/tickets/tests/TicketHistory.test.ts -->
```ts
import { fireEvent, render, screen } from "@testing-library/vue";
import { createTestApp, createTestPlatform, mockMedia } from "@wssto2/vue-core/testing";
import { afterEach, describe, expect, it } from "vitest";
import en from "../i18n/en.json";
import TicketHistory from "../components/TicketHistory.vue";

interface Event {
  id: number;
  at: string;
  kind: "comment" | "change";
  author: string;
  note: string;
}

const events: Event[] = [
  { id: 1, at: "2026-09-30T08:00:00Z", kind: "comment", author: "Ana", note: "Called the customer" },
  { id: 2, at: "2026-09-30T09:30:00Z", kind: "change", author: "Ivo", note: "Closed" },
];

// One environment per test: the platform decides what the user may do, the messages are the feature's own.
const mountHistory = (permissions: string[], rows: Event[] = events) => {
  const app = createTestApp({ platform: createTestPlatform({ permissions }), messages: { en: { tickets: en } } });
  return render(TicketHistory, { props: { events: rows }, global: { plugins: [...app.plugins] } });
};

describe("the ticket history", () => {
  let media: ReturnType<typeof mockMedia> | undefined;
  afterEach(() => media?.restore());

  it("lists the events in the order given, with the kind as a badge", () => {
    mountHistory([]);
    expect(screen.getAllByRole("row").slice(1).map((row) => row.textContent)).toEqual([
      expect.stringContaining("Called the customer"),
      expect.stringContaining("Closed"),
    ]);
    expect(screen.getByText("Status change")).toBeTruthy();
  });

  it("removes only for whoever may update tickets", () => {
    const { unmount } = mountHistory([]);
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    unmount();
    mountHistory(["tickets:update"]);
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(2);
  });

  it("says so when there is nothing yet", () => {
    mountHistory([], []);
    expect(screen.getByText("Nothing has happened yet.")).toBeTruthy();
  });

  it("becomes phone rows below 1024 px, where a long press or a right click lists the row's actions", async () => {
    media = mockMedia({ narrow: true });
    mountHistory(["tickets:update"]);
    expect(screen.queryByRole("table")).toBeNull();
    await fireEvent.contextMenu(screen.getByText("Closed"));
    expect(await screen.findByRole("menuitem", { name: "Remove" })).toBeTruthy();
  });
});
```

## A composable and a collection

`withSetup` runs it inside a component, as it is used (injections, the router, `onScopeDispose`); unmount to stop what it started. `fakeLoader` answers a collection's loader and records every query it was asked, so a test asserts what the list requested, not how it did.

<!-- example: docs/examples/tickets/tests/useTicketList.test.ts -->
```ts
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
```

## The session and the backend's failures

A sequence is `scriptedTransport`: the first answer goes to the first request, the last repeats. A 401 while signed in asks `renewSession`; without a renewal the session ends and `onSessionExpired` runs.

<!-- example: docs/examples/tickets/tests/session.test.ts -->
```ts
import { createTestPlatform, jsonResponse, scriptedTransport } from "@wssto2/vue-core/testing";
import { describe, expect, it, vi } from "vitest";
import { createTicketsApi } from "../api";

const ticket = { id: 1, subject: "Printer", status: "open", assignee: null, created_at: "2026-09-30T08:00:00Z" };

describe("the session under the api", () => {
  it("renews an expired session once and sends the failed request again", async () => {
    // A sequence: the first answer is a 401, the second the ticket.
    const { transport, calls } = scriptedTransport(jsonResponse(401, { message: "expired" }), jsonResponse(200, { success: true, data: ticket }));
    const renewSession = vi.fn(async () => true);
    const platform = createTestPlatform({ transport, renewSession });

    expect(await createTicketsApi(platform.http).get(1, new AbortController().signal)).toEqual(ticket);
    expect(renewSession).toHaveBeenCalledOnce();
    expect(calls).toHaveLength(2);
  });

  it("signs the user out when it cannot be renewed, and tells the application", async () => {
    const onSessionExpired = vi.fn();
    const platform = createTestPlatform({ transport: scriptedTransport(jsonResponse(401, {})).transport, renewSession: async () => false, onSessionExpired });

    await expect(createTicketsApi(platform.http).get(1, new AbortController().signal)).rejects.toMatchObject({ status: 401 });
    expect(platform.session.state.value).toEqual({ status: "anonymous", reason: "expired" });
    expect(onSessionExpired).toHaveBeenCalledOnce();
  });
});
```

What to know:

- **No network.** A platform without a `transport` fails every request with a message naming it; `fetch` is never reached.
- **Platforms share nothing.** Build one per test; `createTestPlatform` calls are independent, as two applications are.
- **Another user mid-test:** `platform.session.establish(createTestSession({ user: { id: 2 }, permissions: ["x"] }))`. Scoped grants: `permissions: { "leads:view": heldAccess("dealer", 5, "own") }`.
- **Your session adapter:** `createTestPlatform({ session: myAdapter })` leaves the session unasked (`restore()` calls it), for testing sign-in flows.
- **`mockMedia`** answers the library's media conditions (`compact`: phones and coarse pointers, `narrow`: below 1024 px, where lists turn into phone rows). Call `restore()` in `afterEach`.
- These examples are run by this package's own tests (`npm test`), so they cannot rot.
