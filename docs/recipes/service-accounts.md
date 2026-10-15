# Recipe: service accounts and API keys

go-core's identity module can serve service accounts: the systems that reach the API with a key (`X-API-Key`) and cannot sign in (`identity.WithServiceAccounts`, routes under `/v1/iam/service-accounts…`). `serviceAccountsFeature()` is the screens, in the same `@wssto2/vue-core/identity` entry. It needs [`accessFeature()`](access.md) next to it: the roles of an account are the access screens', and the application refuses to start without it.

<!-- example: docs/examples/identity/serviceAccounts.ts -->
```ts
// The composition root of an application with service accounts: sign-in, the access screens, then the service account screens.
import { createApplication } from "@wssto2/vue-core/app";
import { accessFeature } from "@wssto2/vue-core/access";
import { identityFeature, identityPlatform, serviceAccountsFeature } from "@wssto2/vue-core/identity";
import { createPlatform, readBootstrap } from "@wssto2/vue-core/platform";
import { backofficeShell } from "@wssto2/vue-core/shell";
import { permissions } from "../access/permissions";

const platform = createPlatform({ config: readBootstrap(), ...identityPlatform() });

void createApplication({
  platform,
  shell: backofficeShell(),
  features: [
    identityFeature({ home: "/" }),
    // The roles of an account are the access screens': install them next to it.
    accessFeature({ catalogue: permissions }),
    // `destination` is the node of the server's menu that opens the list. Every screen and action is behind the permission go-core checks.
    serviceAccountsFeature({ destination: "serviceaccounts" }),
  ],
}).mount("#app");
```

Install it for everyone: the server's catalogue decides who sees what. `iam.serviceaccount:view` reads (an administrator of a tenant sees the tenant's accounts, the server decides which), `:manage` makes, edits and deactivates an account, gives it roles and makes its keys, and `:revoke` revokes a key (its own permission, so a tenant's administrator can stop a key they cannot make).

## The screens

**Service accounts** (`/iam/service-accounts`, route `serviceaccounts.index`). The accounts in grouped rows, each with its description, its tenant (when the application has them), the person who answers for it, the last call and the number of live keys. Views **Active / Inactive / All**, with their counts under the search, which reads the name, description and the responsible person. **New service account** (`:manage`) asks for a name, a description, the tenant and the responsible person; the account opens on its *Access* tab, where the roles and then the first key are given.

**An account** (`/iam/service-accounts/:id`, `serviceaccounts.record`), in tabs that the URL can name (`?tab=general | access | keys`):

| Tab | What it does |
|---|---|
| General | who answers for the account, its tenant, who made it and when, the last call, whether it is active. **Edit account** and **Deactivate account** (both `:manage`; neither on a deactivated account) |
| Access | the same panel as a person's (`PersonAccess` with `{ kind: "service", id }`): its roles with where each applies, *Add role*, removal, and what it can do. Reading is `:view`, changing `:manage` |
| API keys | each key with the start of it, who made it and when, last use and expiry; **New API key** and **Revoke** |

An account has no password and cannot sign in; the screens say so where they ask for it. **Deactivating** stops its keys at once and cannot be undone.

## Keys: shown once

A key's secret exists only in the answer that makes it. **New API key** asks for a name (where the key is used) and an optional expiry (the end of the chosen day); the sheet that follows shows the secret with **Copy**, a plain warning, and one button, *I have saved the key*. Nothing else closes it (not Escape, not a tap outside): what it shows cannot be shown again. The secret lives in that sheet's state and is dropped when it closes. **Copy** uses the clipboard, and the old selection copy on a page that has none (plain HTTP on a local address). To replace a key, make a new one, move the system over to it, then revoke the old.

## Tenants

go-core's `serviceaccount.Tenants` confines accounts to the tenants of an application whose data is scoped by one (`Level: "dealer"`). Without it an account has no tenant and the screens show none. With it, tell the screens what to call a tenant and which ones to offer:

<!-- example: docs/examples/identity/serviceAccountTenants.ts -->
```ts
// An application whose service accounts belong to a dealer (go-core's `serviceaccount.Tenants` with Level "dealer").
import { route, type HttpClient } from "@wssto2/vue-core/client";
import { serviceAccountsFeature } from "@wssto2/vue-core/identity";

const dealers = route<void, { id: number; name: string }[]>("GET", "/v1/crm/dealers");

export function createServiceAccountsFeature(http: HttpClient) {
  return serviceAccountsFeature({
    destination: "serviceaccounts",
    tenants: {
      // The i18n key of your word for a tenant (`dealer: "Dealer"`): the column, the field and the row carry it.
      labelKey: "dealer",
      // The tenants an account can be confined to, among the ones the person may choose (the server refuses any other).
      options: async (signal) => (await http.request(dealers, undefined, { signal })).data,
    },
  });
}
```

Whoever holds `iam.serviceaccount:manage` for the whole organization (outside every tenant) may also make an account of the organization (no tenant); the field starts at it and says *Organization*. Anyone who holds it at one tenant has to choose a tenant. The people offered as the responsible person are the active ones of the users list (its largest page, 500), which needs `iam.user:view`.

## Linking

`serviceAccountsRoutes.index` and `serviceAccountsRoutes.record({ id })` are typed targets for a link or `router.push`. The route names (`serviceaccounts.index`, `serviceaccounts.record`) and the paths are fixed. `serviceaccountRoutes` is go-core's route table for your own calls.

## Testing

`startScreen`-style tests are written against the whole application: the library's own tests mount `accessFeature` and `serviceAccountsFeature` on a fake server (`createTestPlatform`, `routedTransport` from `@wssto2/vue-core/testing`) and drive the DOM; see [testing](testing.md).
