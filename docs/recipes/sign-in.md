# Recipe: sign-in with go-core's identity module

go-core's `identity` module serves the sign-in routes (`/v1/auth/login`, `refresh`, `logout`, `me`, `change-locale`, `login-as`) and the session payload. This library has the other half: the types of that contract, the sign-in page, and the session wiring. An application installs two things.

<!-- example: docs/examples/identity/main.ts -->
```ts
// The composition root of an application on go-core's identity module: sign-in, session and language.
import { createApplication } from "@wssto2/vue-core/app";
import { identityFeature, identityPlatform } from "@wssto2/vue-core/identity";
import { createPlatform, readBootstrap } from "@wssto2/vue-core/platform";
import { backofficeShell } from "@wssto2/vue-core/shell";
import { createTicketsFeature } from "../tickets/feature";

// `identityPlatform()` wires the session to go-core's routes (read it, end it, renew it on a 401).
const platform = createPlatform({ config: readBootstrap(), ...identityPlatform() });

const application = createApplication({
  platform,
  shell: backofficeShell(),
  // The sign-in page (route `login`) and the person's language come with the feature.
  features: [identityFeature({ home: "/tickets" }), createTicketsFeature(platform.http)],
});

void application.mount("#app");
```

## What `identityPlatform()` does

- **Reads the session** from `GET /v1/auth/me`. When that answers 401 (the access token ran out while the app was closed) it swaps the refresh cookie for new tokens once before it decides nobody is signed in, so a returning person is not sent to the sign-in page for nothing. Anything but 401 (a server fault, an unreadable payload) is a failed start, not a signed-out user.
- **Renews on a 401** while signed in: one refresh, then the session is read again and the failed requests are sent once more. If the refresh is refused the session ends with reason `expired` and the router sends the person to the sign-in page, remembering where they were.
- **Ends the session** with `POST /v1/auth/logout` after the before-sign-out hooks; a session that is already over is not an error.
- The user is go-core's default projection, `IdentityUser` (`id`, `login`, `name`, `email`, `locale`). A server with its own `UserProjector` passes `parseUser`, which must keep the `id` and the `login` (the prompt for an expired session shows it):

<!-- example: docs/examples/identity/user.ts -->
```ts
// An application whose server projects more than go-core's default user (`UserProjector`) reads it itself; the `login` stays, the prompt for an expired session shows it.
import { identityPlatform } from "@wssto2/vue-core/identity";
import { createPlatform, readBootstrap, type SessionUser } from "@wssto2/vue-core/platform";

interface Employee extends SessionUser {
  readonly login: string;
  readonly name: string;
  readonly dealer: string;
}

const parseEmployee = (raw: unknown): Employee => {
  const { id, login, name, dealer } = raw as { id: number; login: string; name: string; dealer: string };
  return { id, login, name, dealer };
};

export const platform = createPlatform({ config: readBootstrap(), ...identityPlatform({ parseUser: parseEmployee }) });
```

## What `identityFeature()` installs

- **The sign-in page** at `/login` (route name `login`, public, the default of `router.login`): a username and a password, a required-field check before the server is asked, and the server's refusals said under the password in the app's language. After signing in the person goes where they were heading (`?redirect=`), else to `home`.
- **Session upkeep**: `keepSessionAlive`, renewing shortly before the access token expires and when the app comes back to the foreground.
- **The language**: the language saved on the person is applied when their session begins (also after a reload), and a language chosen in the account menu is saved with `change-locale`. A save that fails is a toast; the page stays in the chosen language. Do not also pass `locale.onChange` for this.

## Refusals

The page says what go-core says; the texts are `core.errors.identity.*` in en, hr, bs and sl, and an app overrides any with `errors.identity.…` of its own.

| Answer | Reason | Said |
|---|---|---|
| 422 | `identity.signin.failed` | Invalid username or password. (an unknown login and a wrong password answer alike) |
| 422 | `identity.signin.locked`, `params.locked_until` | Too many wrong passwords. Sign-in is locked until 14:35. (the time of day, in the app's locale) |
| 400 | `identity.signin.inactive` | This account is not active. (said only to whoever gave its right password) |
| 429 | | Too many requests in a short time. Wait a minute and try again. |
| 401 | `identity.session.invalid` | Your session has ended. Sign in again. |

`signIn(platform, { login, password })` is the call behind the page, for an application with a sign-in page of its own; `lockedUntil(error)` reads the end of a lock from its refusal.

## The module's types

go-core's identity and access contracts are committed in this library (`src/modules/`), generated by go-core's `cmd/modulets`, so the screens and the application read one copy. They are exported as `@wssto2/vue-core/identity` and `@wssto2/vue-core/access`: the entity types, the input types (`Inputs.LoginInput`), and the route tables to call with `client.request`:

<!-- example: docs/examples/identity/profile.ts -->
```ts
// The module's route tables are called like any typed route.
import { identityRoutes } from "@wssto2/vue-core/identity";
import type { Platform } from "@wssto2/vue-core/platform";

export async function loadProfile(platform: Platform) {
  const { data } = await platform.http.request(identityRoutes.profileShow);
  return data; // ProfileResponse
}
```

`package.json` names the go-core version (`"goCore": "v1.6.0-rc.3"`); `npm run modules:sync -- <go-core checkout at that tag>` rewrites the files and `npm run check:modules` (part of `npm run check`) fails when a file was written by another version or edited by hand. The input schemas are exported as types only; an application that validates with the Zod schemas generates its own with go-core's `contract.Generate`.

## Developing against go-core

go-core's dev server serves identity and access over an in-memory database with two accounts (`admin` / `admin-password`, `user` / `user-password`); `admin` may sign in as `user`, which shows the banner:

```sh
go run github.com/wssto2/go-core/cmd/devserver     # 127.0.0.1:8090, /api
cd playground && npm run dev                       # then open /identity.html
```

Vite forwards `/api` to it, so the cookies are same-origin; the dev server also allows the browser origin `http://localhost:5173` (`-origin` for another). The playground's other pages keep their fake transport, which is also what your tests use (`routedTransport`, see [testing](testing.md)): answer `GET /v1/auth/me` with the payload of your server.

## A session that ends in the middle of work

When the refresh is refused while someone works, `identityFeature` does not send them to the sign-in page: the page stays, behind a scrim, and a dialog (wide screens) or a bottom sheet (phones) asks for the password again. The login is shown and fixed: it is the same person's page. Signing in closes it and the page carries on exactly as it was, so a form keeps its draft; Escape does nothing; **Sign out instead** asks the unsaved-changes question first, then goes to the sign-in page. A session that ended while the app was closed still lands on the sign-in page (nothing is on screen to keep), and so does one that ended while signed in as somebody else (the password is not the real person's to give).

This is the router and the session working together, and any feature can use it: `defineFeature({ holdsExpiredSession: true })` says it shows its own prompt, and `heldSession(state)` (from `/platform`) gives the session that just expired, so the shell, the menu and permissions keep showing what they showed. The identity feature needs a shell with a `host` slot (`backofficeShell()` has one).

## Signed in as somebody else

go-core's `login-as` signs in as another person when the application allowed it, and the session payload then names the real person (`impersonator`, also on the session: `session.state.value.impersonator`). While it does, a warning strip stretches across the top of the shell, above everything, with one button, **Return to my account**: it calls `login-as/return` (no password; the person's own session comes back) and goes to the home page, since what was on screen belonged to the other person. The strip stays at the top while the page scrolls and cannot be dismissed; what is sticky below it (the top bar on phones, a page's toolbar, the sidebar) starts under it, through `--shell-banner-h`. It is a `banner` slot contribution, so a custom shell renders `<ShellOutlet name="banner" />` at its top.

The entry point is `SignInAsButton`, for a person's page or a row, shown only to whoever holds the permission you name (your catalogue says which; the server decides again), never for oneself and never while already signed in as somebody else:

<!-- example: docs/examples/identity/SignInAs.vue -->
```vue
<script setup lang="ts">
import { SignInAsButton } from "@wssto2/vue-core/identity";

defineProps<{ person: { id: number; name: string } }>();
</script>

<template>
  <!-- Shown to whoever holds the permission; the server decides again. -->
  <SignInAsButton :user-id="person.id" :name="person.name" permission="tickets:update" />
</template>
```

`signInAs(platform, userId)` and `returnToOwnAccount(platform)` are the calls behind them. Their refusals are `core.errors.identity.impersonation.*` (`disabled`: the application did not say who may; `not_active`: the session is not an impersonation).
