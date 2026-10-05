# Changelog

## Unreleased

### Fixes
- `keepSessionAlive` no longer reads the session back after a `renew` that ended it. An app that expired the session on a refused refresh was signed straight back in by that read (the access token was still valid), and the new session renewed at once: arv-next called `/auth/me` and `/auth/refresh` every ~150 ms until the access token ran out or the rate limiter answered 429. A `renew` that leaves the session signed in is read back as before.

## 0.4.2 — 2026-10-05

A checked menu item now shows its tick.

### Requires
- go-core unchanged: **`v1.7.0`**; **`vue` 3.5.19 or later**.

### Changes to existing behaviour
- A `Menu` item with `checked: true` draws a tick (the same one the account menu uses for its selected row) at the trailing end, after the label and before a `shortcut`; on phones it sits at the trailing end beside the icon. Unchecked items reserve nothing. The role stays `menuitemradio` with `aria-checked`; the tick is `aria-hidden`. This shows the current choice in every `CollectionFilterMenu` and in a location switcher built on `Menu`.

## 0.4.1 — 2026-10-05

Shell fixes for the arv-next cutover: a search place in the shell, pull to refresh, and the dev-mode readonly warnings gone.

### Requires
- go-core unchanged: **`v1.7.0`**.
- **`vue` 3.5.19 or later** (peer, was 3.5.0). Before 3.5.19 Vue wrote the element into the readonly ref `useTemplateRef` returns, so every first mount of a dev build logged `Set operation on key "value" failed: target is readonly` (about ten times in the shell, once at a sign-in route). Upgrade `vue` to clear them.

### Added
- The shell's `search` slot: a contribution `{ slot: "search", component }` renders at the top of the sidebar, under the brand, and at the top of the phone drawer. Nothing contributed, nothing rendered. `backofficeShell()` offers it; a custom shell lists `"search"` in its `slots` and renders `<ShellOutlet name="search" />`, or marks the contribution `optional`.
- `useOptionalPageChrome` is exported from `@wssto2/vue-core/page` (the page chrome, or `null`, for a component that may be mounted without the application, e.g. in a unit test).

### Changes to existing behaviour
- Pull to refresh is on in `BackofficeShell` whenever the application runs installed (`display-mode: standalone`, or iOS `navigator.standalone`): pulling down from the top of the page reloads the page only (the shell's page outlet remounts; the sidebar, top bar, drawer and open popovers stay). Vertical downward drags from the scroll top only; never with a dialog or the drawer open; threshold 72, resistance 0.5, the indicator spins at least 600 ms, reduced motion keeps it still; unsaved changes ask first. Turn it off with `backofficeShell({ pullToRefresh: false })`. An application that had its own pull to refresh should remove it.
- The readonly warnings above are gone with the `vue` peer bump; no source change.

## 0.4.0 — 2026-10-04

The screens for go-core's notification module (in-app notifications, e-mail settings and quiet hours) and the failed events of its event queue. Built and checked against go-core `v1.7.0`.

### Requires
- go-core **`v1.7.0`** or later on the server (`package.json` `"goCore"`); the committed module types are now written by it (`src/modules/notification`, `src/modules/events`; identity and access are unchanged). `Item.category` is a plain string; `GET /v1/events/consumers` needs `events.deadletter:view`.

### Notifications (`/notifications`, new)
- `notificationsFeature({ categories?, deadLetters?, settings? })`: the bell in the shell's `headerActions` (unread count, `99+`), the inbox it opens (a popover on wide screens, a bottom sheet on phones: newest first, "Show older" by `before_id`, unread marked, relative time, a category icon and hue; a tap marks the notification read and opens its link through the router; "Mark all as read" sends the newest id the inbox shows, so one that arrives meanwhile stays unread) and the live stream behind it. The stream is read with `fetch` through the session's cookies, reconnects with a 1 s to 30 s backoff after refetching the count, drops a connection silent for two heartbeats, catches up when the page returns to the foreground or the network returns, and is ended and cleared with the session (sign-out, expiry, signing in as somebody else).
- The failed events page (`/events/dead-letters`, route `events.deadletters`, `events.deadletter:view`): the dead letters of every consumer with a consumer filter and paging; "Retry" and "Retry all for this consumer" (after a question) behind `events.deadletter:retry`. `deadLettersRoutes`, `notificationRoutes`, `eventsRoutes` and the wire types are exported; `deadLetters: { destination }` binds the menu, `deadLetters: false` leaves the page out.
- Notification settings (`settings`, default true): the page `/profile/notifications` (route `notifications.settings`, target `notificationSettingsRoutes.index`) for any signed-in person, from the account menu ("Notification settings") and from a gear in the inbox (beside the close button in the sheet's header on phones). "E-mail me about": a switch per category go-core lists, saved as it is switched (at once, taken back with a message when refused); a setting someone else enforces is a locked row, "Set by your organisation"; without e-mail on the server one sentence and no switches; in-app listed as always on. Quiet hours: on or off, from and to (`TimeField`), a line in words with the server's time zone, over midnight allowed, equal times refused on the field. The names of the categories are the application's texts `notifications.categories.<code>.label` (and `.description`), the code split at its dots, falling back to the code. `settings: false` leaves the page, the entry and the gear out.
- The "Consumer" filter of Failed events is a choice among the consumers `GET /v1/events/consumers` lists (a text field if they cannot be read).
- Texts `core.notifications.*`, `core.notifications.settings.*` and `core.notifications.dead_letters.*`, and go-core's reasons `core.errors.notification.*`, in en, hr, bs, sl. Playground: `identity.html` has the bell and "Send a test notification". Recipe "Notifications".
- Core icons `notification3Line`, `checkDoubleLine`, `settings3Line` and `moonLine`.
- `Sheet` has an `actions` slot: buttons in its default header, just before the close button.

### Changes to existing behaviour
- `defineCollection({ query: { search: false } })` leaves the search field out of the toolbar (`collection.searchable`); the default is unchanged.
- The desktop sidebar is stacked above the page toolbar (`z-30`), so a popover opened from the rail is not painted under the page.
- A context menu that closes while it is being positioned no longer throws (`Menu`).

## 0.3.0 — 2026-10-03

The screens for go-core's identity and access modules: sign-in, the session-expiry prompt, impersonation, users and "my profile", a person's activity, roles and access; and typed routes on the HTTP client. Built and checked against go-core `v1.6.0`.

### Requires
- go-core **`v1.6.0`** or later on the server (`package.json` `"goCore"` names the version the committed module types come from).
- `zod` is an optional peer dependency: only needed when you use the generated input schemas.

### Changes to existing behaviour
- `HttpClient` gained `request(route, input)`: a hand-written `HttpClient` implementation must add it.
- `createPlatform({ renewSession })` is called with the platform's client as a second argument (`(session, http) => …`); one-argument functions keep working.
- A custom shell must render `<ShellOutlet name="banner" />` (the impersonation strip) and keep a `host` slot to use `identityFeature`; it fails at start-up otherwise. `backofficeShell()` has both.
- `identityPlatform({ parseUser })` needs the user to keep a `login` (the session-expiry prompt shows it).
- An expired session can now be held on its page (`defineFeature({ holdsExpiredSession })`); apps without such a feature behave as before.

### Identity and access (`/identity`, `/access`, new)
- go-core's module contracts, committed under `src/modules/` (`cmd/modulets`): entity types, input types (`Inputs.*`, types only) and the route tables `identityRoutes` / `accessRoutes`. `npm run modules:sync -- <go-core checkout>` rewrites them; `npm run check:modules` (part of `npm run check`) fails on another go-core version than `package.json` `"goCore"` or a hand edit. `zod` is an optional peer dependency (the declarations of the input types name it).
- `identityFeature({ home? })`: the sign-in page at `/login` (route `login`; required fields, generic failure, the lock with the time it ends, 429), session upkeep (`keepSessionAlive`), and the person's language kept in step with the server (the saved language applied when the session begins, a language chosen in the account menu saved with `change-locale`).
- `identityPlatform({ parseUser? })`: `createPlatform({ config, ...identityPlatform() })` wires the session to `/v1/auth/*` (read `me`, with one refresh when the access token ran out; sign-out) and the refresh on a 401. `signIn`, `lockedUntil`, `identitySessionAdapter`, `renewIdentityTokens`, `parseIdentityUser` for applications with their own page. Checked against go-core's session payload fixture.
- Texts: `core.identity.signin.*`, `core.errors.identity.*` (signin failed / locked / inactive, session invalid, locale invalid, impersonation disabled, account not found / inactive) in en, hr, bs, sl.
- Playground: `identity.html` signs in against go-core's dev server (`go run github.com/wssto2/go-core/cmd/devserver`, Vite proxies `/api`). Recipe "Sign-in".
- The session-expiry prompt (`docs/design/SessionExpiry.dc.html`): a session that expires while someone works stays on its page; a dialog (wide screens) or bottom sheet (phones) asks for the password with the login fixed, drafts survive, Escape does nothing, "Sign out instead" asks the unsaved-changes question first. Not held when the session was an impersonation. Behind it: `defineFeature({ holdsExpiredSession })`, `session.holdExpired(enabled)` (set by `createApplication`), `heldSession(state)` and `previous` on the anonymous/expired state (`/platform`); the shell, menu, navigation and permissions follow the held session; `installRouterGuards({ holdExpired })`.
- Impersonation (`docs/design/Impersonation.dc.html`): `SessionSnapshot.impersonator` (`{ id, name }`, read from go-core's payload); a warning strip in the new `banner` shell slot, sticky at the top (the sidebar, top bar, page toolbars and side navigators start below it through `--shell-banner-h`) ("Return to my account" calls `login-as/return`, then home; not dismissible); `SignInAsButton` (only with the permission you name, never for oneself or while impersonating); `signInAs`, `returnToOwnAccount`. Custom shells render `<ShellOutlet name="banner" />`; `identityFeature` fails at start-up in a shell without a `banner` or `host` slot.
- `src/modules` contains no `any`, so it is linted like the rest.
- `identityPlatform({ parseUser })` needs the user to keep a `login` (the expiry prompt shows it).

### Users and "my profile" (`/identity`)
- `usersFeature({ people?, profile?, signInAs?, destination?, sections? })`: the users list (`/users`: views active / locked / inactive / all, search, sort, paging, state in the URL, "New user") and a person's record (`/users/:id`: details edited in place, sign-in with the lock / unlock / new password / `SignInAsButton`, sessions, sign-in history, changes with before and after; deactivate with confirmation and the reason of the application's hook, activate), and "my profile" (`/profile`: name and phone, password, e-mail change by code with `OtpInput`, resend with the server's cooldown, resume or cancel; own sessions with this device marked; own sign-ins; an account-menu entry). Every screen and action is behind the permission go-core checks; `people: false` / `profile: false` leave a part out, `destination` binds the list to the menu, `sections` adds sections of the application's own to the record (a `PersonSection`: child route, `props` from the person, route meta). Typed targets `usersRoutes`, `profileRoutes`. Server field errors land on the fields, forms guard unsaved changes, refusals are said in words: `core.errors.identity.*` (all of go-core's reasons for these routes) in en, hr, bs, sl. Texts `core.users.*`, `core.profile.*`, `core.account.*`.
- Activity section on a person's record (`iam.user.activity:view`, go-core `GET /v1/iam/users/:id/activity`): area tabs with the server's counts, a date range, rows by day, the "signed in as" mark; `usersFeature({ activityAreas })` names the application's areas.
- New core icons (`listCheck`, `user3Line`, `key2Line`, `deviceLine`, `timeFill`, `edit`, `lockLine`, `checkCircle`, `addLine`, `mailUnreadFill`, `eyeOff`).
- Playground: `identity.html` shows both sides against go-core's dev server. Recipe "Users and profile".
- History rows carry `{ id, name }` (`PersonRef`) as `actor`, `opened_by`, `signed_in_as`; the screens show those names (empty name, a deleted person, reads "somebody else") and `useActorNames` with its per-person lookups is gone, so "my profile" names who signed in as the person too. `ListResult.meta.views` is typed `readonly ViewCount[]` (`{ key, count }`, `ViewCount` exported from `/client`): the users list, activity, sign-in and changes tabs read their counts with no cast. New tabs with counts: sign-ins **All / Failed** (record and "my profile"), changes **All / Access / Details**; the `view` input is a typed enum (invalid: 422 `identity.list.view_invalid` / `identity.history.view_invalid`).

### Roles and access screens (`/access`)
- `accessFeature({ catalogue, subjectRoute?, scopes?, destination? })`: the roles list (`/iam/roles`, kinds and search), a role's page with the editor, holders, *Copy* (`/iam/roles/new?copy=`), *Compare with a predefined role*, *Replace* (its holders move; all or none) and *Delete* (its own permission), a new role. The permission tree is the application's `authzts` catalogue: modules as tabs, screens as groups, requirements kept consistent (a role that lacks what its permissions need is completed on load, with a note), *whose* held once per record type, sensitive / system / whole-organization marks. Pages and actions behind `iam.role:view|manage|delete` and `iam.user:view|manage`; typed targets `accessPages`.
- `PersonAccess` (a person's roles with *Add role* and *Remove*, and *What {name} can do* with *Why*), `BindingRow`, `personRolesSection` (the `meta` for a record section). *Add role* reads the places from the server (`/scopes`), derives the hierarchy from them (no level names in the library), asks level and place only where the hierarchy has levels, and lists the roles the actor may give there; with one level it asks nothing, and the root level is the `root_level` the server reports.
- `authz.*` refusals in words in en, hr, bs, sl (`core.errors.authz.*`, overridable with `errors.authz.*`): `useRefusalMessage()` for a form's `failureMessage`.
- Texts under `core.access.*`; the application supplies a permission's label (its catalogue's keys), `access.modules.*`, `access.resources.*`, `access.ownable.*`, `access.roles.<key>`, `access.levels.*`. Icons `shieldStarFill`, `addLine`, `swapBoxLine` join the library's own.
- Playground: `identity.html` edits roles and binds them to people against go-core's dev server. Recipe "Roles and access".

### Client (`/client`)
- `route<In, Out>(method, path, options?)` and `route.raw(...)`: plain typed route values, the shape go-core's generator emits (`permission`, `public`). Raw routes (streams, files) keep method and path for links and are not callable through `request`.
- `client.request(route, input, options?)`: `:params` filled from `input` (encoded), the rest the query for GET/DELETE and the JSON body for POST/PUT/PATCH; resolves to `ApiResult` as `get`/`post` (`data: null` for a `void` route). A missing path parameter throws a plain `Error` naming the route, before sending. Path parameters are checked by go-core, not by TypeScript.
- `ListResult<Row>`: the wire type of go-core's datatable result; `readListPage` (`/collection`) takes it with `Row` inferred.
- Recipe "Typed routes". Type fixtures from go-core's generated route tables in `test-data/go-core` (go-core 727a37b), run by `npm run typecheck:fixtures` (adds `zod` as a dev dependency).

## 0.2.0 — 2026-10-02

What arv-next needs before it can switch to the library. Additions only; nothing public was removed or renamed.

### Forms (`/form`)
- `useOptions({ for, load })`: select options that load from the server. `SelectField` and `MultiSelectField` take them in `options`: a spinner in the field while loading, a "Loading…" row, a failed row with "Try again", the latest input wins (older requests are aborted). A value is cleared only when options arrive for a different input (the user picked another make), never on the first load, so an edit form keeps a saved value the list no longer offers.
- `selected` on `SelectField` / `MultiSelectField`: the label of the current value before the options arrive.
- `NumberField :grouping="false"`: no thousands separator (years, coordinates).
- The select list is at least as wide as its field (`Popover` `matchTriggerWidth`).
- `CommandDialog` `#actions` slot and `run({ addAnother: true })`: save and add another. Recipe "One record in a dialog (create and edit)".

### App, state and shell
- `AccessGate` (`/platform`): shows its content only when the user holds `permission`, `any` or `all`; `#fallback`.
- `useLoad(load, { watch })` (`/state`): one load with latest-wins, `reload()`, `update(value)`; pairs with `AsyncSection`.
- `useDescribeError()` (`/i18n`): an `ApiError` (or any error) as a sentence for the user; app `errors.<code>` keys win over `core.errors.*`.
- `useOpenDialogCount()` (`/overlay`), `modalPlacementKey` and `Modal` `placement` (`/modal`): for an app shown inside another page's frame.
- Keyboard shortcuts take `group` and `label`; `useShortcutRegistry()`, `shortcutKeys()` (`/button`) and the `ShortcutHelp` "?" dialog (`/modal`). The library's own shortcuts are listed.
- `createApplication({ locale: { flags } })`: the language menu shows a flag and the language's own name.
- `Badge hue="…"`: nine category colours (amber, lime, teal, cyan, blue, indigo, violet, fuchsia, pink), separate from the status tones, AA contrast in light and dark; tinted or `appearance="dot"`.

### Tables (`/collection`)
- `DataTable`: a table over an array (no fetching, paging or URL state), built from the same parts as `CollectionTable`, with phone rows for columns that have `mobile` roles.
- `RowActions`: the row's action buttons from the same `RowAction[]` as swipe and the context menu.

### Testing (`/testing`, new)
- `createTestPlatform`, `createTestApp`, `withSetup`, `stubRoutes`, `scriptedTransport`, `routedTransport`, `jsonResponse`, `fakeLoader`, `listPage`, `createTestI18n`, `testFormatting`, `settle`, `deferred`, `mockMedia`. No test-runner dependency. Recipe: `docs/recipes/testing.md`.

## 0.1.0 — 2026-10-01

First release: shell, routing, permissions, lists, record pages, forms and fields, dates and times, phone numbers, suggestions, per-language text, photo viewer, step forms.
