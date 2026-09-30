import type { HttpClient } from "@wssto2/vue-core/client";
import { httpList } from "@wssto2/vue-core/collection";
import type { Lead } from "../crmdata/data";

export type { Lead };

export function createLeadsApi(http: HttpClient) {
  return {
    list: httpList<Lead>(http, "/crm/leads"),
    get: (id: number, signal?: AbortSignal) => http.get<Lead>(`/crm/leads/${id}`, { signal }).then((result) => result.data),
  };
}

export type LeadsApi = ReturnType<typeof createLeadsApi>;
