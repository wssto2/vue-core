import type { InjectionKey } from "vue";
import { defineFeatureContext } from "@wssto2/vue-core/platform";
import type { Resource, RouteResource } from "@wssto2/vue-core/resource";
import type { Customer, Dealer, Lead, PhaseEvent } from "./api";

// Declared once per record: the routed sections read them with `useRouteResourceContext(KEY)`.
export const DEALER_RESOURCE: InjectionKey<RouteResource<Dealer>> = Symbol("records.dealer");
export const CUSTOMER_RESOURCE: InjectionKey<RouteResource<Customer>> = Symbol("records.customer");
export const LEAD_RESOURCE: InjectionKey<RouteResource<Lead>> = Symbol("records.lead");

/** What the lead page shares besides its record: the phase history it loads on its own, so its section and its track show one read. */
export const [LEAD_HISTORY, useLeadHistory] = defineFeatureContext<Resource<readonly PhaseEvent[]>>("records.lead.history");
