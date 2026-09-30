import { defineFeature, provideContext } from "@wssto2/vue-core/app";
import type { HttpClient } from "@wssto2/vue-core/client";
import { createMemorySavedViews } from "@wssto2/vue-core/collection";
import { localeMessages } from "@wssto2/vue-core/i18n";
import { createLeadsApi } from "./api";
import { createLeadList } from "./collection";
import { LEADS } from "./context";
import { leadRoutes } from "./routes";

export function createLeadsFeature(http: HttpClient) {
  const api = createLeadsApi(http);
  return defineFeature({
    id: "leads",
    routes: leadRoutes.records,
    context: provideContext(LEADS, { api, list: createLeadList(api), savedViews: createMemorySavedViews() }),
    messages: localeMessages("leads", { en: () => import("./i18n/en.json"), hr: () => import("./i18n/hr.json") }),
    navigation: [{ destination: "leads", to: leadRoutes.index, within: ["leads.record"] }],
    backend: ["leads"],
  });
}
