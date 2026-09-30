import { defineCollection } from "@wssto2/vue-core/collection";
import type { CustomersApi } from "./api";

// One definition: the list page and the record page's previous / next both read it.
export function createCustomerList(api: CustomersApi) {
  return defineCollection({
    id: "crm.customers",
    stateVersion: 1,
    load: api.list,
    key: (customer) => customer.id,
    query: { sorts: ["created_at", "updated_at"], filters: ["city"] },
    defaults: { sort: "created_at", direction: "desc" },
  });
}
