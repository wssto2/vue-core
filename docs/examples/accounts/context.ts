import type { InjectionKey } from "vue";
import { defineFeatureContext } from "@wssto2/vue-core/platform";
import type { RouteResource } from "@wssto2/vue-core/resource";
import type { Account, AccountsApi } from "./api";

// The record, shared with its routed sections: the page provides it, each section reads it with `useRouteResourceContext(ACCOUNT)`.
export const ACCOUNT: InjectionKey<RouteResource<Account>> = Symbol("accounts.record");

export const [ACCOUNTS_API, useAccountsApi] = defineFeatureContext<AccountsApi>("accounts.api");
