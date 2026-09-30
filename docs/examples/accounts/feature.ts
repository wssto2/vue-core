import { defineFeature, provideContext } from "@wssto2/vue-core/app";
import type { HttpClient } from "@wssto2/vue-core/client";
import { localeMessages } from "@wssto2/vue-core/i18n";
import { createAccountsApi } from "./api";
import { ACCOUNTS_API } from "./context";
import { accountRoutes } from "./routes";

export function createAccountsFeature(http: HttpClient) {
  return defineFeature({
    id: "accounts",
    routes: accountRoutes.records,
    context: provideContext(ACCOUNTS_API, createAccountsApi(http)),
    messages: localeMessages("accounts", { en: () => import("./i18n/en.json") }),
    navigation: [{ destination: "accounts", to: { name: "accounts.record", params: { accountID: 1 } }, within: ["accounts.record"] }],
  });
}
