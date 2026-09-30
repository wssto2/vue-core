import { defineFeature, provideContext } from "@wssto2/vue-core/app";
import type { HttpClient } from "@wssto2/vue-core/client";
import { localeMessages } from "@wssto2/vue-core/i18n";
import { createCustomersApi } from "./api";
import { createCustomerList } from "./collection";
import { CUSTOMERS } from "./context";
import { customerRoutes } from "./routes";

export function createCustomersFeature(http: HttpClient) {
  const api = createCustomersApi(http);
  return defineFeature({
    id: "customers",
    routes: customerRoutes.records,
    context: provideContext(CUSTOMERS, { api, list: createCustomerList(api) }),
    messages: localeMessages("customers", { en: () => import("./i18n/en.json"), hr: () => import("./i18n/hr.json") }),
    navigation: [{ destination: "customers", to: customerRoutes.index, within: ["customers.record"] }],
    backend: ["customers"],
  });
}
