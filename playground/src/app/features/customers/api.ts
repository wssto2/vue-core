import type { HttpClient } from "@wssto2/vue-core/client";
import { httpList } from "@wssto2/vue-core/collection";
import type { Customer } from "../crmdata/data";

export type { Customer };

/** The customers endpoints, over the application's client: views never build requests. */
export function createCustomersApi(http: HttpClient) {
  return {
    list: httpList<Customer>(http, "/crm/customers"),
    get: (id: number, signal?: AbortSignal) => http.get<Customer>(`/crm/customers/${id}`, { signal }).then((result) => result.data),
  };
}

export type CustomersApi = ReturnType<typeof createCustomersApi>;
