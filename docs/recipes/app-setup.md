# Recipe: application setup

`docs/examples/app/main.ts` is the smallest composition root. This is what a real application adds; every option is optional.

<!-- example: docs/examples/app/production.ts -->
```ts
// The options a real application usually sets on top of main.ts. Every one is optional.
import { createApplication, defineFeature } from "@wssto2/vue-core/app";
import { createPlatform, readBootstrap } from "@wssto2/vue-core/platform";
import { backofficeShell } from "@wssto2/vue-core/shell";
import { pushCleanup } from "./effects";
import { sessionFeature } from "./session/feature";

// The server's page state: the shared keys (api_base, locale, app_name, capabilities) plus your own section,
// validated in one go. A missing or wrong value is one error naming every problem, before anything renders.
const config = readBootstrap({
  extend: (fields) => ({ market: fields.string("market", "hr"), currency: fields.string("currency") }),
});

const platform = createPlatform({
  config,
  // A 401 while signed in: renew once (true sends the failed request again); otherwise the session ends.
  renewSession: async (session) => {
    const response = await fetch(`${config.apiBase}/auth/refresh`, { method: "POST", credentials: "same-origin" });
    if (!response.ok) return false;
    await session.refresh();
    return true;
  },
  // Runs at every sign-out while the session still exists (max 3 s; a failure is reported, never blocks).
  beforeSignOut: async (user) => void navigator.sendBeacon(`${config.apiBase}/presence/leave`, JSON.stringify({ user: user.id })),
  onSessionError: (error) => console.error("session", error),
});

export const application = createApplication({
  platform,
  shell: backofficeShell(),
  features: [sessionFeature, defineFeature({ id: "push", effects: [pushCleanup] })],

  // Locales: the server's choice when offered, else `fallback`. The library ships en, hr, bs, sl and sr-Latn (Serbian, ekavian, Latin).
  locale: {
    supported: ["hr", "en"],
    fallback: "en",
    // A flag beside each language's own name in the account menu; a flag stands for a language, so you choose (English is not one country).
    flags: { en: "GB", hr: "HR" },
    // After a switch committed (not for the start locale, nor a superseded switch): save it on the user.
    onChange: async (locale) => void (await platform.http.put("/profile/locale", { locale })),
  },

  // Your texts per locale, merged over the library's `core` messages (any of its keys can be overridden).
  i18n: { messages: { en: { core: { shell: { account: { sign_out: "Log out" } } } } } },
  // Dates the way your users write them; the rest keeps the Intl defaults.
  formatting: { date: (value) => value.toLocaleDateString("de-DE") },

  // The destinations your backend's menu may name; a feature binding another one fails at startup.
  navigation: { known: ["tickets", "accounts"] },
  router: { login: { name: "login" }, home: "/tickets" },

  // Every error the application caught: component errors, unhandled rejections, failed effects and loads.
  onError: (report) => console.error(`[${report.source}]`, report.feature ?? "", report.error),
});
```

## The platform

`createPlatform` builds one set of services per application (two platforms share nothing): `http` (the client), `session`, `access` and `config`. It makes no request at construction; `createApplication().mount()` restores the session.

- **The client** (`platform.http`) puts the API prefix on every path, sends the request id, aborts on `signal`, and throws `ApiError` with a `kind` (`validation`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `server`, `network`, `aborted`...), the server's message and the request id. The default transport is `fetch`; pass `transport` for another.
- **The session** reads `GET /auth/me` and ends with `POST /auth/logout` by default (`httpSessionAdapter`); give `session` an adapter, or `(http) => adapter`, for another backend or another user shape. `session.state` is reactive: `unknown`, `loading`, `anonymous` (with a `reason`: `none`, `expired`, `signedOut`), `authenticated` or `failed` (the server could not say: not the same as signed out).
- **Renewal.** `session.renew()` is the one way a session is renewed: it runs your `renewSession` once and every caller shares it, so the refresh token (go-core rotates it on every use) is never presented twice. `keepSessionAlive` calls it before the expiry, the client calls it after a 401, and your own fetch wrapper (one that does not go through `platform.http`) calls `platform.session.renew()` too, and sends its request again when it resolves `true`. A refused or throwing renewal ends the session (`onSessionExpired` runs once). A session that cannot be renewed, such as an embed bearer token with no refresh token, says so with `renewable: () => false` on `createPlatform`: a 401 then ends it at once and `keepSessionAlive` stays idle. Without `renewSession` a session is not renewable either.
- **Expiry.** A 401 while signed in calls `session.renew()` (so `renewSession` once, however many requests failed at once); `true` sends the failed requests again, otherwise the session expires and the user is sent to the login page, remembering where they were (`returnTo(route)` on the login page). A feature that asks for the password again on the page itself (`identityFeature`, see [sign-in](sign-in.md)) keeps the person where they are instead.
- **The session's language.** When the session loads with a user whose `locale` is one the application offers and differs from the active one, `mount()` switches to it (loading its texts) before the first navigation, so the first page renders in it. This reads `user.locale` only; map the server's codes to your locale codes in the user parser (`session` adapter). `identityFeature` keeps later changes in step.
- **Signing out** clears the state first, so nothing else can read the old session, then tells the server. `beforeSignOut` (or `session.onBeforeSignOut(hook)` from an effect) runs first, **while the session still exists**, for at most 3 seconds: remove this device's push subscription, flush a draft. A failing or late hook is reported to `onSessionError` and never blocks the sign-out.

### Your user and config, declared once

The platform is typed from `PlatformRegistry`, the way permissions are typed from `PermissionRegistry`: say once what your session user and your bootstrap config are, and `usePlatform()`, `useSessionUser()`, `createApplication` and `createTestPlatform` all resolve to them, with no cast and no explicit `Platform<User, Config>`. Both keys are optional; without them the user is `SessionUser` (`{ id }`) and the config `BootstrapConfig`. `createPlatform<User, Config>` stays generic and builds a platform of the same type.

<!-- example: docs/examples/registry/declarations.ts -->
```ts
// What the application says once about its session user and its config: every reader (`usePlatform()`,
// `useSessionUser()`, `createApplication`, `createTestPlatform`) is typed from it, with no cast and no generics.
import type { BootstrapConfig } from "@wssto2/vue-core/platform";

export interface AppUser {
  readonly id: number;
  readonly name: string;
  readonly locale: string;
}

export interface AppConfig extends BootstrapConfig {
  readonly market: string;
}

declare module "@wssto2/vue-core/platform" {
  interface PlatformRegistry {
    user: AppUser;
    config: AppConfig;
  }
}
```

`useSessionUser()` is the signed-in user as a readonly ref (`null` while nobody is signed in); `usePlatform().session` remains the way to reach the impersonator and the rest of the state. After a save the app knows the new user: `session.update({ user })` replaces it in place (also `access` and `navigation`). That is not a sign-in: the status, expiry and impersonator stay, requests in flight are not cancelled and readers just see the new value. It does nothing unless somebody is signed in, and throws for a different `user.id` (a different person is `session.establish`).

<!-- example: docs/examples/registry/ProfileName.vue -->
```vue
<script setup lang="ts">
import { ref } from "vue";
import { useSessionUser, usePlatform } from "@wssto2/vue-core/platform";

// `user` is the registered AppUser or null; `config.market` is typed too.
const user = useSessionUser();
const { http, session, config } = usePlatform();
const name = ref(user.value?.name ?? "");

async function save(): Promise<void> {
  if (!user.value) return;
  const { data } = await http.put<{ name: string }>("/profile", { name: name.value });
  // The same person, changed in place: nothing in flight is cancelled and nothing flickers (a different
  // person is `session.establish`, which throws here by design). `useSessionUser()` shows the new name.
  session.update({ user: { ...user.value, name: data.name } });
}
</script>

<template>
  <form @submit.prevent="save">
    <p>{{ user?.name }} ({{ config.market }})</p>
    <input v-model="name" />
    <button type="submit">Save</button>
  </form>
</template>
```

## Effects

Background behavior is never a component with a timer. It is an **effect** a feature lists: `scope: "app"` starts once per mounted application, `scope: "session"` starts when someone signs in, restarts when the user changes (`sessionKey` decides what "changes" means) and stops on sign-out or expiry. It receives an `AbortSignal` that aborts when it must end, reports failures to the application's `onError`, and returns a function that cleans up. `keepSessionAlive()` is one, the session feature in the examples uses it.

<!-- example: docs/examples/app/effects.ts -->
```ts
import type { SessionEffect } from "@wssto2/vue-core/app";

async function removePushSubscription(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  await (await registration.pushManager.getSubscription())?.unsubscribe();
}

// Background behavior is an effect: started when someone signs in, stopped (its returned function runs) when the
// session ends or changes. This one asks the session to run a cleanup while the user is still signed in, so a signed-out
// device stops receiving the user's notifications. `onBeforeSignOut` returns the function that removes the hook.
export const pushCleanup: SessionEffect = {
  id: "push.cleanup",
  scope: "session",
  start: ({ platform }) => platform.session.onBeforeSignOut(removePushSubscription),
};
```

## Locales and texts

The start locale is the server's (`config.locale`) when it is among `locale.supported`, else `locale.fallback`. `application.setLocale(code)` loads the namespaces in use for the new locale and only then switches, so a switch never shows a raw key; a slower earlier switch that finishes late is dropped. `locale.onChange(locale)` is called once after each switch that committed, for persisting it on the user; its failure goes to `onError` with `source: "locale"` and does not undo the switch.

The account menu (desktop popover and phone sheet) lists the languages by their own name. With `locale.flags` (`{ en: "GB", hr: "HR" }`, ISO country codes) each row also shows that country's flag, as an SVG that loads when it is first shown; a locale without an entry shows its name alone. The mapping is yours because a flag stands for a language, not a country.

The library's Bosnian is `bs` and its Serbian is `sr-Latn` (ekavian, Latin script; a bare `sr` would print Cyrillic): name the locales that way, not by market (`ba`, `rs`), which `Intl` reads as other languages. A locale the library has no texts for shows the `locale.fallback` language's. Chromium's `Intl` has no Bosnian data (it formats `bs` as English and still reports `bs`), so the library hands `Intl` `sr-Latn-BA` for `bs`: numbers, amounts, dates, calendars, relative times and country names read Bosnian in every browser, with nothing to configure.

## Dates and numbers your way

`formatting` starts from `Intl`'s output and changes only what you name. Besides replacing a formatter (`date`, `dateTime`, `time`, `number`, `money`, `relative`), it takes settings that the library applies to every formatter, so `format.*`, `<Money>` and the date fields write the same style:

- `intlLocale`: language code → the BCP 47 tag `Intl` gets, over the library's own (`bs` → `sr-Latn-BA`, because Chromium has no Bosnian data). `{ en: "en-GB", sl: "sl-SI", "sr-Latn": "sr-Latn-RS" }` makes English a 24-hour clock and gives Slovenian and Serbian their country's conventions. Time and relative text use it too; `format.intlLocale` is the tag of the active language for code that calls `Intl` itself. Name the codes the library's way (`sl`, `bs`, `sr-Latn`); an app that keeps market codes (`si`, `ba`) maps them to those before they reach `formatting`, because `Intl` reads `si` as Sinhala and `ba` as Bashkir.
- `datePattern`: language code → a numeric date written with `DD`, `MM` and `YYYY`: `{ hr: "DD.MM.YYYY.", en: "DD/MM/YYYY", sl: "DD.MM.YYYY" }`. `format.date` is `30.09.2026.`, and `format.dateTime` is the pattern, a space and the 24-hour time (`30.09.2026. 14:05`). A language not listed keeps `Intl`'s date.
- `numberSymbols`: `{ group: ".", decimal: "," }` writes every number with those symbols in every language, grouped from four digits (`1.234`, where `Intl` leaves it to the language), with the fraction rounded like `toFixed` (`1.005` at two digits is `1,00`; `Intl` says `1,01`) and `useGrouping: false` honoured. A `style` other than decimal (`percent`, `unit`) stays `Intl`'s. `format.money` with an ISO currency is then this number, a space and the currency's symbol (`12,50 €`).
- `emptyNumber`: what `format.number` returns for null, undefined or NaN (`"0"`); without it, like every `format.*`, the empty string.

`format.day(value)` is "Today" or "Yesterday" (the `core.activity.today` / `yesterday` texts of the active language) for those two days and `format.date(value)` for any other; `{ inSentence: true }` gives the lower-case word for a sentence ("opened yesterday"), and `format.dayTime(value)` adds `· 14:05`. `createApplication` hands the formatting your i18n, so you set nothing for it; an app that builds `createFormatting` itself passes `translate`, and without it `day` is the date.

Dates from a server arrive in forms `new Date` is unreliable with, so every `format.*` function reads them through `toDate`: `YYYY-MM-DD HH:mm[:ss]` (MySQL's form, which Safari rejects) is local time; a bare `YYYY-MM-DD` is that calendar day at local midnight, never the day before in a zone west of Greenwich; and an unset date (anything starting `0000-00-00`, `0001-01-01` or `1970-01-01`, or an epoch number) is nothing to show, the empty string.

## Amounts, install and offline

`createFormatting({ locale, currencySymbol: "KM" })` takes a `currencySymbol`, which is a display symbol (not an ISO code), shown after the amount and a space, and `format.money(amount)` without a currency uses it (two decimals, through your `number` formatter); `format.money(amount, { currency: "EUR" })` uses `Intl`'s currency style. Both take `decimals` (fraction digits), `whole` (no fraction on a whole amount) and `symbol: false` (the number alone): `format.money(39600, { whole: true })` is `39.600 KM`; a missing amount is the empty string, as in every `format.*` function, while `<Money>` draws it as zero. `<Money :amount="price" />` from `@wssto2/vue-core/content` draws an amount that way (tabular figures, a quieter symbol) with `whole` (no fraction on a whole amount), `decimals`, `:symbol="false"`, `empty-zero` (a dash for null or 0) and `signed` (a green "+" or a red "−" for a change); a null amount reads as zero.

`@wssto2/vue-core/pwa` is the client half of an installable app: call `captureInstallPrompt()` at start-up (the browser fires `beforeinstallprompt` once, early), then `useInstallPrompt()` gives `canInstall`, `installed` and `install()` for a button, with `isStandalone()` and `currentPlatform()` ("ios" | "android" | "desktop") for the iPhone hint. `registerServiceWorker({ url: "/sw.js", enabled: import.meta.env.PROD })` registers your own worker after the page loads, with the build's entry script as `?build=` so each deploy installs a fresh one; pass `enabled: false` in development and inside an embedding page's frame. The worker's caching and offline page stay yours (`installPushHandlers` from `push-worker` belongs in it).

## Permissions in the UI

`AccessGate` (from `@wssto2/vue-core/platform`) shows its content only when the session's access allows it: one `permission`, `any` of several or `all` of several, typed against your `PermissionRegistry` (the same names as route `meta.access`). It follows the session, so a permission refresh applies at once, and its `fallback` slot shows something else when access is missing. It decides what to offer; the server authorizes every request.

<!-- example: docs/examples/app/Actions.vue -->
```vue
<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { AccessGate } from "@wssto2/vue-core/platform";
import "./declarations"; // the application's permissions: a name that is not declared there is a compile error below
</script>

<template>
  <!-- One permission, or any of / all of several. The server still authorizes every request: this decides what to offer. -->
  <AccessGate permission="tickets:update"><Button prominence="primary">Edit</Button></AccessGate>
  <AccessGate :any="['tickets:update', 'accounts:view']"><Button>Export</Button></AccessGate>
  <AccessGate :all="['tickets:update', 'accounts:view']">
    <Button>Reassign</Button>
    <!-- Shown instead when access is missing -->
    <template #fallback><span class="text-footnote text-content-muted">Ask an administrator to reassign.</span></template>
  </AccessGate>
</template>
```

## Error sentences

`useDescribeError()` (from `@wssto2/vue-core/i18n`) returns a function that turns any failure into the sentence to show: for a toast after a mutation, an inline message, a region's failure. Call the hook in `setup` and use the function anywhere later. It chooses, in order:

1. The backend's reason: go-core's `code` with its `params`, looked up as `errors.<code>` in your messages, then `core.errors.<code>` (your keys win over the library's). Without a text of yours, the server's own sentence (it translates what it sends with a reason).
2. The kind of failure: 401 not signed in, 403 no access, 404 not found, 409 changed or exists, 429 too many requests, no answer (offline), cancelled, and "check the marked fields" for a validation answer that has fields.
3. Your `fallback` for a server fault, an unreadable answer or an error that is not a failed request (else a general "unexpected error"); also for any other 4xx, which otherwise shows the server's text, the only description of a rule the client cannot know.

<!-- example: docs/examples/app/errors.ts -->
```ts
// Texts for the reasons your backend sends: go-core answers `{ code: "accounts.plan_in_use", params: { count: 3 } }`,
// and `describeError` looks for `errors.accounts.plan_in_use` in your messages (then in the library's `core.errors`).
export const errorMessages = {
  en: { errors: { accounts: { plan_in_use: "The plan is still used by {count} accounts. Move them first." } } },
  hr: { errors: { accounts: { plan_in_use: "Plan još koristi {count} računa. Prvo ih premjestite." } } },
};
```

<!-- example: docs/examples/app/ArchiveButton.vue -->
```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Button } from "@wssto2/vue-core/button";
import { useDescribeError } from "@wssto2/vue-core/i18n";
import { toast } from "@wssto2/vue-core/overlay";
import { usePlatform } from "@wssto2/vue-core/platform";

const props = defineProps<{ planId: number }>();
const { t } = useI18n();
const { http } = usePlatform();
const describeError = useDescribeError(); // call it in setup; use the function anywhere later

async function archive() {
  try {
    await http.delete(`/plans/${props.planId}`);
    toast.success(t("accounts.archived"));
  } catch (error) {
    // The backend's reason when you have a text for it, else a sentence for the kind of failure (signed out, no access,
    // not found, offline, "check the marked fields"); your fallback for a server fault and anything unreadable.
    toast.error(describeError(error, { fallback: t("accounts.archive_failed") }));
  }
}
</script>

<template>
  <Button tone="critical" @click="archive">{{ t("accounts.archive") }}</Button>
</template>
```

The same goes for the messages a server sends for a field (`{ fields: { oib: ["validation_errors.required"] } }`): say once how one becomes a sentence, beside `describeError`, and every form (`useForm`, `useResourceForm`, `useCommand`) uses it unless it has its own `describeFieldError`. Without either, messages show as sent.

`useServerMessages()` (also `@wssto2/vue-core/i18n`) is that rule for go-core's refusals, ready to spread into a form or a command: `describeFieldError` (a field's reason, `identity.email.taken`, becomes your `errors.<reason>` or the library's `core.errors.<reason>`), `failureMessage(kind, error)` (a refusal of the whole action says its reason) and `sentence(error)` for a toast. Put your own refusals first with `failureMessage: (kind, error) => mine(error) ?? messages.failureMessage(kind, error)`.

<!-- example: docs/examples/app/describeFieldError.ts -->
```ts
import type { AppFieldErrorDescriber } from "@wssto2/vue-core/i18n";

// The server sends a field's message as a key ("validation_errors.required"); `createApplication({ describeFieldError })` words it once for every form.
const sentences: Readonly<Record<string, string>> = { "validation_errors.required": "This field is required.", "validation_errors.unique": "Already in use." };
export const describeFieldError: AppFieldErrorDescriber = (message, field) => sentences[message] ?? (field === "oib" ? `OIB: ${message}` : message);
```

`toast.message` is the plain toast, without a status icon: a neutral fact, usually with Undo (`success`, `info`, `warning`, `error` and `loading` carry a status; use one when the status is the news). `onDismiss(id)` runs when the user swipes the toast away or closes it, not when it times out, its action is pressed, or code calls `toast.dismiss(id)`; an undo that commits later can commit at once there: `toast.message(t("filterDeleted"), { action: { label: t("undo"), onClick: undo }, onDismiss: commit })`.

Regions and forms word their own failures already (`useResource`, `useLoad`, `useForm` report to their frames and banners); this is for the places that do not.

## Startup and errors

`mount()` restores the session, loads the essential texts and makes the first navigation before anything renders. If the session or the texts cannot load, a failure view with a retry is mounted instead; `application.state` says which. `onError` receives every error the application caught, tagged by `source`: `vue`, `unhandledrejection`, `window`, `effect`, `messages`, `session`, `router`, `locale`.

`application.dispose()` unmounts and removes every guard, listener, timer and effect; two applications on one page, or one mounted and disposed repeatedly (a test), leave nothing behind.

## Testing a feature

`createPlatform` accepts a `transport` and a `session`, so a test builds a platform over a fake backend and mounts the real application with a memory history (`router: { history: createMemoryHistory() }`) and no server.
