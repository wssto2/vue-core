# Changelog

## 0.3.0 (unreleased)

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
