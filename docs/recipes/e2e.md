# Recipe: end-to-end specs

`@wssto2/vue-core/playwright` answers the library's own endpoints in a Playwright spec, so a spec does not rebuild go-core's wire: the `{ success, data }` envelope, `GET /auth/me` for a signed-in person, the access, notification, profile and users routes. Each mock registers only its own paths (`page.route`), so your application composes them with the rest of its API; the fixtures are typed from vue-core's go-core module types, so a wire change breaks the build, not a spec at run time. `@playwright/test` is an optional peer (types only): install it in the application that runs specs.

| | |
|---|---|
| `ok(data, meta?)`, `pageOk(rows, meta?)`, `datatable(rows, views?)` | The envelope, go-core's paged list and its datatable answer. `json`, `noContent`, `sse` and `refusal(status, code, { params, field })` build `route.fulfill` answers. |
| `mockAuth(page, permissions, { user, access, scope, navigation })` | Signs the page in. The default user is neutral (`defaultUser`: id, login, name, email, locale); `user` merges your application's fields over it. Permissions are held at the organization (root) unless `scope` says `{ level, id }`; `access` sets a qualifier (`own`, `own_location`, `all`) per permission. |
| `accessOf`, `authResponse`, `authBody` | The pieces of that answer, for a spec that serves `/auth/refresh` or `/auth/login-as` itself. |
| `serveAccess(page, { roles, places, bindings, bindable, holders, canManage, next, hook })` | Roles (list, record, create, update, delete, holders, compare, replace) and a person's or service account's access, scopes and bindings, with state. Returns `{ calls, roles, bindings, reads }`. Build the data with `role`, `bindingOf`, `scopeOf`, `ORGANIZATION`, `invalid`. |
| `serveNotifications(page, { items, categories, devices, quiet, push, stream, failList, … })` | The inbox, the live stream, preferences, quiet hours, push and devices, with state. Returns `{ calls, items, unread, categories, quiet, devices, streams }`. It does not sign in: call `mockAuth` too. |
| `serveProfile(page, { profile, answers, sessions, signins })` | "My profile": the record, the e-mail change with its confirmation, the password, the own sessions and sign-ins. `answers` makes one endpoint answer something else (a refusal). Returns `{ calls, state }`. |
| `serveUsers(page, { state, filter, hook })` | `/iam/users` (the list with its views, record, create, update, unlock, sessions, sign-ins, changes, activity) and `/iam/service-accounts` (list, record, keys). `freshState({ people, … })` is the state, `person`, `session`, `signin`, `change`, `activity` and `serviceAccount` build its rows. Returns `{ writes, state }`. |

Playwright runs the last registered route first, and `route.fallback()` hands a request to the one before. The mocks fall back for every path that is not theirs, so register your catch-all (`**/api/v1/**`) first and the library's mocks after it, or the other way round when your routes are more specific.

## Your application's wrapper

The library's user has no field of your application. Wrap `mockAuth` once with the fields and the place your specs share, and keep your roles and places in one file:

<!-- example: docs/examples/e2e/support.ts -->
```ts
import type { Page } from "@playwright/test";
import { bindingOf, mockAuth as mockSession, role, scopeOf, serveAccess, serveNotifications, type MockAuthOptions } from "@wssto2/vue-core/playwright";

// e2e/support.ts: the application's own wrapper over the library's mocks. The library knows go-core's wire and a neutral
// user; the application adds its user's fields, its roles and its places, so no spec repeats them.
export const appUser = { account_type_id: 1, dealer_id: 1, locale: "hr" };

const dealer = scopeOf("dealer", 1, "Acme Zagreb");
export const SELLER = role("seller", { name: "Seller", grants: [{ permission: "crm.lead:view", qualifier: "own" }] });
export const MANAGER = role("manager", { name: "Manager", grants: [{ permission: "crm.lead:view", qualifier: "all" }] });

/** Signs in a person of this application who holds `policies` at dealer 1. */
export const mockAuth = (page: Page, policies: string[] = [], options: MockAuthOptions = {}) =>
  mockSession(page, policies, { scope: { level: "dealer", id: 1 }, ...options, user: { ...appUser, ...options.user } });

/** The roles page: the application's roles and places, one person already holding the seller role. */
export const serveRoles = (page: Page) =>
  serveAccess(page, {
    roles: [SELLER, MANAGER],
    places: { root_level: "organization", root: true, places: [{ level: "dealer", id: 1, name: dealer.name!, parent_level: "organization", parent_id: null }] },
    bindings: { "user:3": [bindingOf(1, SELLER, dealer)] },
  });

/** The bell: sign in, then the library's notification routes on the application's time zone. */
export const serveBell = async (page: Page, policies: string[] = []) => {
  await mockAuth(page, policies);
  return serveNotifications(page, { timeZone: "Europe/Zagreb" });
};
```

## A spec

A spec signs in, serves the screen's routes, drives the page, and reads what the page sent from `calls` (or `writes`):

<!-- example: docs/examples/e2e/roles.spec.ts -->
```ts
import { expect, test } from "@playwright/test";
import { MANAGER, mockAuth, serveRoles } from "./support";

test("a manager gives a person the manager role", async ({ page }) => {
  await mockAuth(page, ["iam.role:view", "iam.role:manage", "iam.user:view"]);
  const access = await serveRoles(page);

  await page.goto("/iam/users/3");
  await page.getByRole("button", { name: "Add role" }).click();
  await page.getByRole("option", { name: MANAGER.name }).click();
  await page.getByRole("button", { name: "Save" }).click();

  // The next read shows the change; the spec reads what the page sent through `calls`.
  expect(access.calls).toContainEqual({ method: "POST", path: "/iam/users/3/bindings", body: { role_ref: "manager", level: "dealer", scope_id: 1 } });
  expect(access.bindings["user:3"]).toHaveLength(2);
});
```

What is your application's stays yours: the `ext` of a person, the routes you add beside the library's (`iam/profile/account`), the rest of your API. Give `serveUsers` a `filter` for your list parameters and a `hook` to answer a request first (it returns an answer, or undefined to leave the request to the library); a path none of them serves falls through to your own routes.

The library tests these mocks against a stand-in for `Page`, not a browser; the first run against a real page is your application's.
