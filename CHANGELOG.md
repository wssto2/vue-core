# Changelog

## 0.3.0 (unreleased)

### Identity and access (`/identity`, `/access`, new)
- go-core's module contracts, committed under `src/modules/` from go-core `v1.6.0-rc.3` (`cmd/modulets`): entity types, input types (`Inputs.*`, types only) and the route tables `identityRoutes` / `accessRoutes`. `npm run modules:sync -- <go-core checkout>` rewrites them; `npm run check:modules` (part of `npm run check`) fails on another go-core version than `package.json` `"goCore"` or a hand edit. `zod` is an optional peer dependency (the declarations of the input types name it).
- `identityFeature({ home? })`: the sign-in page at `/login` (route `login`; required fields, generic failure, the lock with the time it ends, 429), session upkeep (`keepSessionAlive`), and the person's language kept in step with the server (the saved language applied when the session begins, a language chosen in the account menu saved with `change-locale`).
- `identityPlatform({ parseUser? })`: `createPlatform({ config, ...identityPlatform() })` wires the session to `/v1/auth/*` (read `me`, with one refresh when the access token ran out; sign-out) and the refresh on a 401. `signIn`, `lockedUntil`, `identitySessionAdapter`, `renewIdentityTokens`, `parseIdentityUser` for applications with their own page. Checked against go-core's session payload fixture.
- Texts: `core.identity.signin.*`, `core.errors.identity.*` (signin failed / locked / inactive, session invalid, locale invalid, impersonation disabled, account not found / inactive) in en, hr, bs, sl.
- Playground: `identity.html` signs in against go-core's dev server (`go run github.com/wssto2/go-core/cmd/devserver`, Vite proxies `/api`). Recipe "Sign-in".
- `createPlatform({ renewSession })` is called with the platform's client as a second argument (`(session, http) => …`); existing one-argument functions keep working.
- The session-expiry prompt (`docs/design/SessionExpiry.dc.html`): a session that expires while someone works stays on its page; a dialog (wide screens) or bottom sheet (phones) asks for the password with the login fixed, drafts survive, Escape does nothing, "Sign out instead" asks the unsaved-changes question first. Not held when the session was an impersonation. Behind it: `defineFeature({ holdsExpiredSession })`, `session.holdExpired(enabled)` (set by `createApplication`), `heldSession(state)` and `previous` on the anonymous/expired state (`/platform`); the shell, menu, navigation and permissions follow the held session; `installRouterGuards({ holdExpired })`.
- Impersonation (`docs/design/Impersonation.dc.html`): `SessionSnapshot.impersonator` (`{ id, name }`, read from go-core's payload); a warning strip in the new `banner` shell slot, sticky at the top (the sidebar, top bar, page toolbars and side navigators start below it through `--shell-banner-h`) ("Return to my account" calls `login-as/return`, then home; not dismissible); `SignInAsButton` (only with the permission you name, never for oneself or while impersonating); `signInAs`, `returnToOwnAccount`. Custom shells render `<ShellOutlet name="banner" />`; `identityFeature` fails at start-up in a shell without a `banner` or `host` slot.
- `src/modules` is generated from go-core `v1.6.0-rc.3` (impersonator, `loginAsReturn`, typed maps); it no longer contains `any`, so it is linted like the rest.
- `identityPlatform({ parseUser })` needs the user to keep a `login` (the expiry prompt shows it).

### Users and "my profile" (`/identity`)
- `usersFeature({ people?, profile?, signInAs?, destination?, sections? })`: the users list (`/users`: views active / locked / inactive / all, search, sort, paging, state in the URL, "New user") and a person's record (`/users/:id`: details edited in place, sign-in with the lock / unlock / new password / `SignInAsButton`, sessions, sign-in history, changes with before and after; deactivate with confirmation and the reason of the application's hook, activate), and "my profile" (`/profile`: name and phone, password, e-mail change by code with `OtpInput`, resend with the server's cooldown, resume or cancel; own sessions with this device marked; own sign-ins; an account-menu entry). Every screen and action is behind the permission go-core checks; `people: false` / `profile: false` leave a part out, `destination` binds the list to the menu, `sections` adds sections of the application's own to the record (a `PersonSection`: child route, `props` from the person, route meta). Typed targets `usersRoutes`, `profileRoutes`. Server field errors land on the fields, forms guard unsaved changes, refusals are said in words: `core.errors.identity.*` (all of go-core's reasons for these routes) in en, hr, bs, sl. Texts `core.users.*`, `core.profile.*`, `core.account.*`.
- Activity section on a person's record (`iam.user.activity:view`, go-core `GET /v1/iam/users/:id/activity`, `goCore` `v1.6.0-rc.4`): area tabs with the server's counts, a date range, rows by day, the "signed in as" mark; `usersFeature({ activityAreas })` names the application's areas. `src/modules` regenerated from `v1.6.0-rc.4` (access: `ScopeOptions.root_level`).
- New core icons (`listCheck`, `user3Line`, `key2Line`, `deviceLine`, `timeFill`, `edit`, `lockLine`, `checkCircle`, `addLine`, `mailUnreadFill`, `eyeOff`).
- Playground: `identity.html` shows both sides against go-core's dev server. Recipe "Users and profile".

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
