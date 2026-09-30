import { defineFeature, provideContext } from "@wssto2/vue-core/app";
import type { HttpClient } from "@wssto2/vue-core/client";
import { localeMessages } from "@wssto2/vue-core/i18n";
import { createTicketFormsApi } from "./api";
import { TICKET_FORMS_API } from "./context";
import { formsRoutes } from "./routes";

// The leave guard needs nothing here: `createApplication` installs it and `backofficeShell` renders its dialog.
export function createTicketFormsFeature(http: HttpClient) {
  return defineFeature({
    id: "forms",
    routes: formsRoutes.records,
    context: provideContext(TICKET_FORMS_API, createTicketFormsApi(http)),
    messages: localeMessages("forms", { en: () => import("./i18n/en.json") }),
  });
}
