import type { AccountTenant } from "../../modules/serviceaccount/entities";
import { defineFeatureContext } from "../../platform";

/** What an application whose accounts are confined to tenants (go-core's `serviceaccount.Tenants`) tells the screens. */
export interface ServiceAccountTenants {
  /** The i18n key that names a tenant in the application's words (`serviceaccounts.tenant` -> "Dealer"): a column, a field, a row. */
  readonly labelKey: string;
  /** The tenants an account can be confined to, among the ones the signed-in person may choose (the server refuses the others). */
  readonly options: (signal: AbortSignal) => Promise<readonly AccountTenant[]>;
}

/** What the screens of `serviceAccountsFeature` need from the feature that installed them. */
export interface ServiceAccountsContext {
  /** `null`: the application has no tenants, accounts belong to the organization and no tenant is shown or asked. */
  readonly tenants: ServiceAccountTenants | null;
}

export const [serviceAccountsContextKey, useServiceAccountsContext] = defineFeatureContext<ServiceAccountsContext>("vue-core.serviceaccounts");
