// An application whose service accounts belong to a dealer (go-core's `serviceaccount.Tenants` with Level "dealer").
import { route, type HttpClient } from "@wssto2/vue-core/client";
import { serviceAccountsFeature } from "@wssto2/vue-core/identity";

const dealers = route<void, { id: number; name: string }[]>("GET", "/v1/crm/dealers");

export function createServiceAccountsFeature(http: HttpClient) {
  return serviceAccountsFeature({
    destination: "serviceaccounts",
    tenants: {
      // The i18n key of your word for a tenant (`dealer: "Dealer"`): the column, the field and the row carry it.
      labelKey: "dealer",
      // The tenants an account can be confined to, among the ones the person may choose (the server refuses any other).
      options: async (signal) => (await http.request(dealers, undefined, { signal })).data,
    },
  });
}
