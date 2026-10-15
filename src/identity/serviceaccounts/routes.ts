import type { RouteRecordRaw } from "vue-router";
import { defineRoutes } from "../../router";
import { VIEW_ACCOUNTS } from "./access";

/**
 * The routes of `serviceAccountsFeature`: typed targets for links (`serviceAccountsRoutes.index`,
 * `serviceAccountsRoutes.record({ id })`), and the records the feature installs. The names and paths are fixed, so a
 * link or a menu binding of the application can name them. The record opens on `?tab=general | access | keys`.
 */
export interface ServiceAccountsRoutes {
  /** The records `serviceAccountsFeature` installs. */
  readonly records: readonly RouteRecordRaw[];
  readonly index: { readonly name: "serviceaccounts.index" };
  readonly record: (params: { id: string | number }) => { readonly name: "serviceaccounts.record"; readonly params: { id: string | number } };
}

// Typed by hand: the inferred type would name the screens' modules in the published declarations.
export const serviceAccountsRoutes: ServiceAccountsRoutes = defineRoutes({
  index: { name: "serviceaccounts.index", path: "/iam/service-accounts", component: () => import("./ServiceAccountsList.vue"), meta: { access: VIEW_ACCOUNTS, titleKey: "core.serviceaccounts.title_plural" } },
  record: {
    name: "serviceaccounts.record",
    path: "/iam/service-accounts/:id",
    component: () => import("./ServiceAccountRecord.vue"),
    meta: { access: VIEW_ACCOUNTS, titleKey: "core.serviceaccounts.title_plural", remountOnParam: "id" },
  },
});
