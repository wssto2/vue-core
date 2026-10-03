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

  // Locales: the server's choice when offered, else `fallback`. The library ships en, hr, bs and sl.
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
- **Expiry.** A 401 while signed in calls `renewSession` once, however many requests failed at once; `true` sends the failed requests again, otherwise the session expires and the user is sent to the login page, remembering where they were (`returnTo(route)` on the login page). A feature that asks for the password again on the page itself (`identityFeature`, see [sign-in](sign-in.md)) keeps the person where they are instead.
- **Signing out** clears the state first, so nothing else can read the old session, then tells the server. `beforeSignOut` (or `session.onBeforeSignOut(hook)` from an effect) runs first, **while the session still exists**, for at most 3 seconds: remove this device's push subscription, flush a draft. A failing or late hook is reported to `onSessionError` and never blocks the sign-out.

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

Regions and forms word their own failures already (`useResource`, `useLoad`, `useForm` report to their frames and banners); this is for the places that do not.

## Startup and errors

`mount()` restores the session, loads the essential texts and makes the first navigation before anything renders. If the session or the texts cannot load, a failure view with a retry is mounted instead; `application.state` says which. `onError` receives every error the application caught, tagged by `source`: `vue`, `unhandledrejection`, `window`, `effect`, `messages`, `session`, `router`, `locale`.

`application.dispose()` unmounts and removes every guard, listener, timer and effect; two applications on one page, or one mounted and disposed repeatedly (a test), leave nothing behind.

## Testing a feature

`createPlatform` accepts a `transport` and a `session`, so a test builds a platform over a fake backend and mounts the real application with a memory history (`router: { history: createMemoryHistory() }`) and no server.
