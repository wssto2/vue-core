import type { InjectionKey } from "vue";
import type { RouteResource } from "@wssto2/vue-core/resource";
import type { Account } from "./api";

/** The account the record page is about, for its routed sections. */
export const ACCOUNT_RESOURCE: InjectionKey<RouteResource<Account>> = Symbol("forms.account");
