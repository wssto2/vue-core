import { defineFeatureContext } from "@wssto2/vue-core/platform";
import type { CustomersApi } from "./api";
import type { createCustomerList } from "./collection";

export interface CustomersDependencies {
  readonly api: CustomersApi;
  readonly list: ReturnType<typeof createCustomerList>;
}

export const [CUSTOMERS, useCustomers] = defineFeatureContext<CustomersDependencies>("playground.customers");
