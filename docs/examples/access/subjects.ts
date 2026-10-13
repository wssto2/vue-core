import { accessFeature } from "@wssto2/vue-core/access";
import { permissions } from "./permissions";

// go-core serves the access routes of people only (`/v1/iam/users/:id/...`). A service account's are yours; they answer in the same wire:
// `${base}/:id/access`, `/scopes`, `/bindings`, `/bindings/:binding_id`, and `bindable` lists the roles it may be given at a place.
export const access = accessFeature({
  catalogue: permissions,
  subjects: { service: { base: "/v1/iam/service-accounts", bindable: "/v1/iam/service-accounts/bindable-roles" } },
});
