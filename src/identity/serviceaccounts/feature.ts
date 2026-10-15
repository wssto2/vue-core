import { defineFeature, provideContext, type Feature } from "../../app";
import type { Destination } from "../../router";
import { serviceAccountsContextKey, type ServiceAccountTenants } from "./context";
import { serviceAccountsRoutes } from "./routes";

export interface ServiceAccountsFeatureOptions {
  /** The tenants accounts are confined to (go-core's `serviceaccount.Tenants`): names the tenant and lists the ones to choose. Without it no tenant is shown or asked for. */
  tenants?: ServiceAccountTenants;
  /** The destination of the backend's menu that opens the list. Without it the application binds the list itself. */
  destination?: Destination;
}

/**
 * The screens of go-core's service accounts, one feature to install: the list (`/iam/service-accounts`, route
 * `serviceaccounts.index`) and an account's record (`serviceaccounts.record`) with its data, its access (the roles it holds,
 * the same panel as a person's) and its API keys: a key is made in a sheet that shows its secret once, with *Copy*, and is revoked
 * from its row. Every screen and action is behind the permission go-core checks for it (`iam.serviceaccount:view`, `manage`,
 * `revoke`), so an application installs it for everyone and the server's catalogue decides who sees what. The server must have
 * service accounts on (`identity.WithServiceAccounts`).
 *
 * An account has no password and cannot sign in; it calls the API with an `X-API-Key` header. It needs `accessFeature()` next to
 * it: the roles of an account are the access screens'.
 *
 *   createApplication({ platform, shell: backofficeShell(), features: [identityFeature(), accessFeature({ catalogue }), serviceAccountsFeature({ destination: "serviceaccounts" })] })
 */
export function serviceAccountsFeature(options: ServiceAccountsFeatureOptions = {}): Feature {
  return defineFeature({
    id: "serviceaccounts",
    routes: serviceAccountsRoutes.records,
    context: provideContext(serviceAccountsContextKey, { tenants: options.tenants ?? null }),
    navigation: options.destination ? [{ destination: options.destination, to: serviceAccountsRoutes.index, within: ["serviceaccounts.record"] }] : [],
    requires: ["access"],
  });
}
