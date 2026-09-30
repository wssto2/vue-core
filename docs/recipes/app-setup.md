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
- **Expiry.** A 401 while signed in calls `renewSession` once, however many requests failed at once; `true` sends the failed requests again, otherwise the session expires and the user is sent to the login page, remembering where they were (`returnTo(route)` on the login page).
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

## Startup and errors

`mount()` restores the session, loads the essential texts and makes the first navigation before anything renders. If the session or the texts cannot load, a failure view with a retry is mounted instead; `application.state` says which. `onError` receives every error the application caught, tagged by `source`: `vue`, `unhandledrejection`, `window`, `effect`, `messages`, `session`, `router`, `locale`.

`application.dispose()` unmounts and removes every guard, listener, timer and effect; two applications on one page, or one mounted and disposed repeatedly (a test), leave nothing behind.

## Testing a feature

`createPlatform` accepts a `transport` and a `session`, so a test builds a platform over a fake backend and mounts the real application with a memory history (`router: { history: createMemoryHistory() }`) and no server.
