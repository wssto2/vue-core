import type { InjectionKey } from "vue";
import { defineFeatureContext } from "@wssto2/vue-core/platform";
import type { RouteResource } from "@wssto2/vue-core/resource";
import type { Ticket, TicketFormsApi } from "./api";

// The ticket the record page is about, shared with the dialogs that act on it.
export const TICKET: InjectionKey<RouteResource<Ticket>> = Symbol("forms.ticket");

export const [TICKET_FORMS_API, useTicketFormsApi] = defineFeatureContext<TicketFormsApi>("forms.api");
