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

1. **Extract, don't invent.** Every component / composable starts from its arv-next source (`/Users/josipzlimen/Projects/arv-next/frontend/…`). Keep its behavior, markup, classes and look. Port its existing tests (`arv-next/frontend/tests`, co-located `*.test.ts`) along with it.
2. **arv-next is read-only.** Never edit, build, or run npm in arv-next. Read it to copy from.
3. **No ARV knowledge in the library.** No imports of ARV `@/stores`, `@/features`, `@/generated`, ARV global types (`Route`, `IconKey`, `MessageSchema`, `UserResponse`), vehicle / dealer / VAT / KM / Croatian business wording. What a component needed from ARV comes in as a prop, a typed option, or a typed Vue injection key the app installs. Fail with a descriptive error when a required provider is missing — no silent defaults, no `any`.
4. **No service locator.** No `resolve<T>()`, no string-keyed registry, no global mutable singletons, no import-time side effects (no requests, timers, listeners at module load).
5. **Peers, not bundles.** `vue`, `vue-router`, `vue-i18n`, `pinia` (only if truly needed) are `peerDependencies`. Add a runtime dependency only when the arv-next source already uses it and it cannot reasonably be dropped; say so in the phase report.
6. **Library strings** live under the `core` i18n namespace in `src/i18n/{en,hr,bs,sl}.json` (copy the existing ARV texts for the strings you move). Apps can override them.
7. **Public surface is deliberate.** Everything consumers use is exported through a subpath in `package.json` `exports` (`@wssto2/vue-core/<area>`). Nothing is reachable by deep import.
8. **Styling:** Tailwind v4 with the ARV tokens moved into `src/styles/` as semantic tokens (`@theme inline`), brand accent overridable by CSS variables. No parallel styling system.
9. **Commits:** one commit per step inside a phase, conventional messages (`feat(collection): …`). Targeted checks per step; the full gate (`npm run check`) once at the end of the phase. Never mark a check passed that did not run.
10. **Stop at the phase boundary.** Report: what was extracted from where, what was changed and why, what was left out, gate output, open questions. Do not start the next phase.

## Layout

```
src/
  client/      HTTP client, ApiError, request ids, abort
  platform/    createPlatform, bootstrap config, session/access interfaces, typed context helper
  app/         createApplication, defineFeature, feature contexts, effects, lifecycle
  router/      defineRoutes, guards, navigation binding
  i18n/        core messages + feature locale loader
  styles/      tokens, theme, styles.css entry
  icon/ controls/ button/ overlay/ modal/ state/   presentation primitives
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
| **V5** Collections | `defineCollection` + `useCollection` with a typed `load(query, {signal})` loader (no `.withURL()` in the final API), validated URL state, latest-request-wins, neighbors from the same definition; `CollectionTable`/`CollectionList`/`CollectionFilter*`/`CollectionPager`/cells; `CollectionPage` only if it removes real duplication | `frontend/components/collection/`, customer + lead `views/Index.vue` as reference usages | V4 |
| **V6** Records | `useRouteResource` (+ pluggable ID parser, default positive int), stale-response protection, `SectionNavigator` from route meta with first-accessible-section redirect, `ResourcePage` only if justified | `frontend/components/resource/`, `components/page/SectionNavigator.vue`, dealer `views/Details.vue` | V4 |
| **V7** Forms | form state (`useResourceForm`, error bags, dirty snapshot, leave guard, save chrome), fields (`components/form/*`), `FormGroup`/`GroupEditAction`/`GroupSheet`/`useGroupSheet`/`useSheetSave`/`useSheetDiscardGuard`/`RecordGroupScope`, `EditorPage`; typed field keys | `frontend/composables/forms/`, `components/form/`, `components/modal/GroupSheet.vue`, `composables/useGroupSheet.ts`, `useSheet*.ts`, `useLeaveGuard.ts`, `useDirtySnapshot.ts` | V5, V6 |

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

Later (not in this run; they need go-core backend modules first): users & sign-in, roles, notifications, home/dashboard UI modules; switching arv-next onto the package.

## Progress

| Phase | State | Commits | Review notes |
|---|---|---|---|
| V1 | Pending | | |
| V2 | Pending | | |
| V3 | Pending | | |
| V4 | Pending | | |
| V5 | Pending | | |
| V6 | Pending | | |
| V7 | Pending | | |
