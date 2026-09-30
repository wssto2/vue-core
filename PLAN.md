# vue-core — build plan

Shared Vue 3 library for go-core applications: the app shell, list / record / form pages and their controls, extracted from arv-next's frontend. First consumers: arv-next (later) and the new application (next month). Design authority is arv-next's UI system (`/Users/josipzlimen/Projects/arv-next/documentation/ui-system/`, "Emerald Native"); the long-form rationale is §6–7 of `/Users/josipzlimen/Projects/arv-next/documentation/GO_CORE_PLATFORM_IMPLEMENTATION_PLAN.md`.

Package name: `@wssto2/vue-core` (not published; consumed locally until the owner decides).

## Relation to the platform plan

This is the frontend half of `GO_CORE_PLATFORM_IMPLEMENTATION_PLAN.md` (**§6 frontend bootstrap, §7 page composition, packets P08.01–P08.09**), with these changes agreed with the owner on 2026-09-30:

- **Own repository and npm package** (`/Users/josipzlimen/Projects/vue-core`), not `go-core/web/vue` — `go-core/web` is already a Go package, and npm gets its own versioning.
- **The real second consumer is the owner's new application** (starts next month), not the plan's invented `examples/helpdesk`. The `playground/` here is only a packaging/consumer check.
- **arv-next is not switched in this run.** The new app adopts vue-core first; ARV's cutover (P08.10–P08.13) comes later, per area, with its own parity checks.
- **Contracts are frozen per phase**, when the phase starts, not all up front (replaces the global P00.04 freeze). A phase may refine an earlier phase's API only by reporting it.
- **Light process:** one agent per phase, commits per step, targeted checks per step, full gate once at the end, review by the coordinator before the next phase. No dispatch records / state machine.
- **Product UI modules (P09.02–P09.04: users & sign-in, roles, notifications; P11.04 home)** wait until the matching go-core backend modules exist. Navigation binding to *generated* backend destinations (P08.05 with P09.01/P10.01) likewise waits; V4 ships typed routes and a destination-binding interface the app fills by hand for now.

Everything §6–7 says a shared piece must *not* do (no frontend DI container, no filesystem discovery, no JSON page renderer, no universal CRUD, no string event bus, no import-time effects, no silent last-writer-wins registration, no ARV business rules) applies here unchanged. §6.7 and §7.7 are the acceptance checklists; each phase below lists the items it must prove.

## Rules for every phase

1. **Start from arv-next, then make it right — never copy blindly.** Every component / composable starts from its arv-next source (`/Users/josipzlimen/Projects/arv-next/frontend/…`) because that behavior is proven and the look is approved. Before moving it, review it: fix bugs, remove accidental complexity, dead props and ARV workarounds, and reshape the API to the design principles below. Keep the approved *look* (Emerald Native) and intended *behavior*; the *code and API* are yours to improve. A change to how something looks or a deliberate behavior change is an open question for the owner, not a silent decision. Port the existing tests (`arv-next/frontend/tests`, co-located `*.test.ts`) and add one for every bug you fix. Every phase report lists **bugs found in arv-next** (file:line, symptom, fix) so the owner can fix them in ARV too, and **API changes vs arv-next** with a one-line reason each.
2. **arv-next is read-only.** Never edit, build, or run npm in arv-next. Read it to copy from.
3. **No ARV knowledge in the library.** No imports of ARV `@/stores`, `@/features`, `@/generated`, ARV global types (`Route`, `IconKey`, `MessageSchema`, `UserResponse`), vehicle / dealer / VAT / KM / Croatian business wording. What a component needed from ARV comes in as a prop, a typed option, or a typed Vue injection key the app installs. Fail with a descriptive error when a required provider is missing — no silent defaults, no `any`.
4. **No service locator.** No `resolve<T>()`, no string-keyed registry, no global mutable singletons, no import-time side effects (no requests, timers, listeners at module load).
5. **Peers, not bundles.** `vue`, `vue-router`, `vue-i18n`, `pinia` (only if truly needed) are `peerDependencies`. Add a runtime dependency only when the arv-next source already uses it and it cannot reasonably be dropped; say so in the phase report.
6. **Library strings** live under the `core` i18n namespace in `src/i18n/{en,hr,bs,sl}.json` (copy the existing ARV texts for the strings you move). Apps can override them.
7. **Public surface is deliberate.** Everything consumers use is exported through a subpath in `package.json` `exports` (`@wssto2/vue-core/<area>`). Nothing is reachable by deep import.
8. **Styling:** Tailwind v4 with the ARV tokens moved into `src/styles/` as semantic tokens (`@theme inline`), brand accent overridable by CSS variables. No parallel styling system.
9. **Commits:** one commit per step inside a phase, conventional messages (`feat(collection): …`). Targeted checks per step; the full gate (`npm run check`) once at the end of the phase. Never mark a check passed that did not run.
10. **Stop at the phase boundary.** Report: what was extracted from where, what was changed and why, what was left out, gate output, open questions. Do not start the next phase.

## API design principles (the SwiftUI / UIKit bar)

The library should read like Apple's frameworks: small, expressive, declarative, hard to misuse.

- **The §7 examples are the target shape.** A typical list page is a typed collection definition + columns array + `<CollectionPage>` with a few cell slots (§7.3); a record page is `useRouteResource` + `<ResourcePage>` + `SectionNavigator` (§7.4). The page families exist so the repeated parts (shell, toolbar, table, filters, pager, loading/empty/error states, back-to-list, section nav) are written once in the library, not on every page.
- **Data as typed definitions, layout as components.** Columns, collection definitions, routes and form groups are typed arrays/objects (like the §7.3 `columns`) — that is data, and TypeScript infers from it. What varies visually goes through typed slots and small child components. What we avoid is a single catch-all options object or JSON that describes a whole screen's layout (§7.2).
- **Names read like sentences.** `useCollection(tickets)`, `list.refresh()`, `sheet.present()`, `sheet.dismiss()`, `resource.reload()`. Components are nouns (`Page`, `Section`, `List`, `Sheet`, `Toolbar`), props are adjectives or roles. No `do`/`handle`/`manager`/`util` names, no abbreviations, no Croatian.
- **Semantic, not visual.** Like `Button(role: .destructive)`: `role="destructive" | "cancel"`, `tone="positive" | "warning" | "critical"`, `prominence="primary"`. The component decides the pixels; the call site states intent.
- **Progressive disclosure.** The common case is one line with good defaults; customization comes through slots and optional props, and the unusual case composes lower-level pieces. Never make the simple case pay for the complex one.
- **One way to do each thing.** No two components or props that overlap; no boolean props that combine into impossible states — use a union (`size="compact" | "regular"`, not `small` + `large`).
- **State is explicit and typed.** Async state is a discriminated union (`{ status: "loading" } | { status: "loaded", value } | { status: "failed", error }`), not a pile of booleans. Slots receive loaded values as non-null.
- **Environment, not globals.** App-wide values (locale, access, icon set, transport, brand) flow like SwiftUI's `Environment`: typed injection keys installed once by the app, overridable for a subtree, with a clear error when missing.
- **Built-in behavior you don't re-implement.** Focus, keyboard, accessibility labels, reduced motion, safe areas, stale-response protection and dirty/discard guards come for free.
- **Fully typed.** Generics flow from the data (row type from the loader, field keys from the form values). No `any`, no casts needed at the call site; misuse is a `vue-tsc` error.

## Layout

```
src/
  client/      HTTP client, ApiError, request ids, abort
  platform/    createPlatform, bootstrap config, session/access interfaces, typed context helper
  app/         createApplication, defineFeature, feature contexts, effects, lifecycle
  router/      defineRoutes, guards, navigation binding
  i18n/        core messages + feature locale loader
  styles/      tokens, theme, styles.css entry
  icon/ controls/ button/ overlay/ modal/ state/ content/   presentation primitives
  shell/       BackofficeShell: sidebar, top bar, phone drawer, account menu, contribution outlets
  page/        AdaptivePageShell, headers, actions, SectionNavigator, EditorPage
  collection/  collection state + table/list/filter/pager
  resource/    route resource state + ResourcePage
  form/        form state, fields, groups, group sheets
playground/    Vite app consuming the package ONLY through its public exports
```

## Phases

| Phase | Scope | Main arv-next sources | Depends on |
|---|---|---|---|
| **V1** Foundation | git repo, package.json with `exports`, Vite library build (ESM + `.d.ts`), TS strict, vue-tsc, ESLint, Vitest + happy-dom + @testing-library/vue, Tailwind v4, `styles.css` with tokens, `playground/` consumer, `npm run check` gate (lint, typecheck, test, build, playground build against the packed output), `CLAUDE.md` with commands and these rules | `frontend/css/`, `vite.config.js`, `tsconfig.json`, `eslint.config.js`, `package.json` | — |
| **V2** Client & platform | HTTP client + `ApiError` + request ids + abort; public bootstrap config reader (validated, business config separate); session and access *interfaces* + `can(permission)` client; `defineFeatureContext` (typed injection key + required lookup); `createPlatform` building one app-scoped client set with no side effects | `frontend/api/base.ts`, `composables/usePolicies.ts`, `composables/fetch/`, `main.ts` config loading | V1 |
| **V3** Presentation primitives | icon (icon set supplied by the app, typed), buttons, controls, `Popover`/`Tooltip`/`Menu`/`AlertDialog`, `Modal`/`Sheet`/`ConfirmModal`/`DiscardChangesModal`, state (`AsyncSection`, `StatusLine`, `ProgressTrack`), `Badge`/`Chip`/`Banner`/`EmptyView`/`KeyValue*`; `AdaptivePageShell`, `PageActions`, `PageToolbar`, `RecordHeader`, `ResourceHeader`, `ResourceBoundary`, page chrome/focus composables; toasts via vue-sonner only if kept | `frontend/components/{icon,button,controls,overlay,modal,state,page}/`, top-level shared components | V1 |
| **V4** App & feature runtime | `createApplication`, `defineFeature` (routes, messages, context, shell contributions, effects), feature locale loader, protected-by-default guards with public opt-in, session-scoped effects with cancellation, `dispose()`, duplicate-registration errors | `frontend/main.ts`, `router/`, `i18n/`, `App.vue`, `layouts/` | V2, V3 |
| **V4b** Backoffice shell | `BackofficeShell` from ARV's layouts: sidebar navigation (server tree via the V4 destination bindings), top bar with page chrome, phone push drawer (UI D18), account menu slot, header action / host outlets for shell contributions (V4), bottom tab bar/dock; custom shells use the same outlets | `frontend/layouts/` (`MainHeader`, `sidebar/*`), `App.vue`, `documentation/ui-system/page-shell.md` | V4 |
| **V5** Collections | `defineCollection` + `useCollection` with a typed `load(query, {signal})` loader (no `.withURL()` in the final API), validated URL state, latest-request-wins, neighbors from the same definition; `CollectionTable`/`CollectionList`/`CollectionFilter*`/`CollectionPager`/cells; `CollectionPage` only if it removes real duplication | `frontend/components/collection/`, customer + lead `views/Index.vue` as reference usages | V4 |
| **V6** Records | `useRouteResource` (+ pluggable ID parser, default positive int), stale-response protection, `SectionNavigator` from route meta with first-accessible-section redirect, `ResourcePage` only if justified | `frontend/components/resource/`, `components/page/SectionNavigator.vue`, dealer `views/Details.vue` | V4 |
| **V7** Forms | form state (`useResourceForm`, error bags, dirty snapshot, leave guard, save chrome), fields (`components/form/*`), `FormGroup`/`GroupEditAction`/`GroupSheet`/`useGroupSheet`/`useSheetSave`/`useSheetDiscardGuard`/`RecordGroupScope`, `EditorPage`; typed field keys | `frontend/composables/forms/`, `components/form/`, `components/modal/GroupSheet.vue`, `composables/useGroupSheet.ts`, `useSheet*.ts`, `useLeaveGuard.ts`, `useDirtySnapshot.ts` | V5, V6 |
| **V8** Polish & docs | The Follow-ups list below; README (getting started: install, composition root, a list page, a record page, a custom shell, theming/brand, i18n) and `docs/recipes/` for each existing area | PLAN Follow-ups, V1–V6 reports | V5, V6 |

### Packet mapping and acceptance per phase

| Phase | Platform-plan packet(s) | Must prove (from §6.7 / §7.7 and the packet's acceptance) |
|---|---|---|
| V1 | P08.01 | Clean pack → playground install, typecheck and production build; no `@/` imports or ARV global types in the emitted `.d.ts`/assets; one Vue/router runtime in the consumer |
| V2 | P08.02 | Transport / 401 / error / abort / bootstrap-validation tests; two platform instances share no state; a custom transport/session adapter typechecks; missing provider → actionable error |
| V3 | P08.03 | Component, focus/keyboard, reduced-motion tests; two themes / two brand accents render in the playground; slots still customizable; package assets resolve |
| V4 | P08.04 + typed-route half of P08.05 | Duplicate / missing / context / startup-failure errors; public vs protected routes; session switch cancels effects and drops late responses; locale race; two app instances; repeated mount/dispose leaves no duplicate guards/listeners; `defineRoutes` rejects a wrong/missing param at compile time (negative `vue-tsc` fixture) |
| V5 | P08.06 + P08.07 | Request race / abort / empty / no-match / error / refresh; URL state validation + back/forward roundtrip; neighbors use the same query; two collections on one page; type fixtures reject unsupported sort/filter keys; customer- and lead-shaped playground lists keep mobile roles, row links and typed slots without casts |
| V6 | P08.08 | Invalid / direct / 404 / retry / racing-ID / save-after-navigation; first-accessible-section and no-access; nested back; one sidebar; a rich custom layout (lead-like) works on the same resource state |
| V7 | P08.09 | Wrong field name rejected by `vue-tsc`; duplicate submit, leave/discard, conflict rebase only where enabled, foreign-field errors, first-error focus, failed save keeps the draft, save-succeeded-refresh-failed; full-record vs dedicated-endpoint group saves stay explicit (D22) |

### Follow-ups (small, not yet assigned)

- `installIcons` accepts partial icon sets and merges them (modular sets per feature), still type-checked against `IconRegistry` (V4b Q6).
- `Icon` size 28 for the top-bar back chevron, to keep ARV's look (V4b Q8).
- `createApplication({ onLocaleChange })` so an app can persist the chosen locale on the user (ARV does) (V4b Q5).
- Bridge V5 ↔ V6: `useCollectionNeighbors` yields a `RecordListContext` for `ResourcePage` (one record pager, not V5's `NeighborPager` and V6's private `RecordPager` side by side).
- Search-text highlight in `RecordIdentity` (ARV's `SearchableToken`) (V5 Q3).
- A before-sign-out hook on the session (ARV removes the push subscription while the session still exists) — needed by the notifications module (V4b Q4).

Later (not in this run; they need go-core backend modules first): users & sign-in, roles, notifications, home/dashboard UI modules; switching arv-next onto the package.

## Progress

| Phase | State | Commits | Review notes |
|---|---|---|---|
| V1 | Done | 2391480…3d3fe83 | Accepted 2026-09-30. Decision: apps with their own Tailwind import `tailwind.css`, which will `@source` the package dist (V3); prebuilt `styles.css` is the fallback. |
| V2 | Done | 58efe42…d3f21a0 | Accepted 2026-09-30. Bootstrap wire keys snake_case (go-core JSON); `/auth/me` keeps ARV's `{user, expires_at, access}`; no per-call parser (generated types). 9 ARV bugs listed in the V2 report. |
| V3 | Done | 8bfdc12…8fe3321 | Accepted 2026-09-30. `tone="critical"` kept (HTML `role` stays free); date/number formatting becomes an app environment in V4; look changes from dropping legacy palettes (Panel radius + hairline, Banner status surfaces, tooltip, skeleton fill, darker muted labels) approved by the owner 2026-09-30 after a before/after comparison; Skeleton sizing fixed on main (caller width/height win). ARV bugs #15–29. |
| V4 | Done | ddb4446…7165912 | Accepted 2026-09-30. Denied routes render a derived no-access state (URL kept, live on permission refresh); nested outlets must be `AppRouterView`; dates numeric by default via `useFormat` (ARV passes its own); record titles with data come from page chrome (V6); `useAppUpdates` + view transitions go to V4b. ARV bugs #30–38. |
| V4b | Done | 5fce035…64091d3 | Accepted 2026-10-01; checked in the browser (desktop sidebar, phone push drawer). Progress bar after 0.3 s (D23), sign-out failure now a toast, tablet sidebar holds still (bug #44). ARV bugs #40–48. |
| V5 | Done | aa1fe81…bc3a747, merge into main | Accepted 2026-10-01. `CollectionPage` justified (customer list 55 lines vs ARV 222, lead 84 vs 470). Sort keeps the page (as ARV); URL state via replace (as ARV); failed load = warning banner with retry (ARV showed "No data"); record pager keys don't auto-repeat. ARV bugs #60–73. |
| V6 | Done | d0a123c…3a96af9, merge be7b4e0 | Accepted 2026-10-01; checked in the browser (dealer sections, lead rich layout). Dependent `useResource({ for: record })` waits for its parent (fixed c0ad1c0, verified in the browser). ResourcePage defaults to `width="content"`; `steps`/`hub` navigator variants not ported. ARV bugs #80–86. |
| V7 | Pending | | |
| V8 | Pending | | |
