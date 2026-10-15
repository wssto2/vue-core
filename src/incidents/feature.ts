import { defineFeature, provideContext, type Feature } from "../app";
import type { Destination } from "../router";
import { ref } from "vue";
import { incidentsContextKey } from "./context";
import ReportHost from "./ReportHost.vue";
import ReportMenuItem from "./ReportMenuItem.vue";
import { incidentsRoutes } from "./routes";

export interface IncidentsFeatureOptions {
  /** The destination of the backend's menu that opens the list. Without it the application binds the list itself. */
  destination?: Destination;
  /** The version of the build: filled into every report a person files (staff can change it). Default: none. */
  appVersion?: string;
}

/**
 * The screens of go-core's incident module, one feature to install: the list (`/incidents`, route `incidents.index`), an incident's
 * record (`incidents.details`) with its reports, comments and, for whoever may change it, the management form, and "Report a bug" in
 * the account menu (a dialog; the staff see the advanced fields). The list and the record are behind `incident:view`, the report
 * and comments behind `incident:create`, the management form behind `incident:update`; `incident:manage` is the staff: all incidents,
 * internal comments, the advanced report fields. Needs a shell with `accountMenu` and `host` places (both are left out without).
 *
 *   createApplication({ platform, shell: backofficeShell(), features: [identityFeature(), incidentsFeature({ destination: "incidents.index", appVersion: __APP_VERSION__ })] })
 *
 * Pair it with `clientErrorReporter()` as the application's `onError` to have the browser's own errors join the incidents.
 */
export function incidentsFeature(options: IncidentsFeatureOptions = {}): Feature {
  return defineFeature({
    id: "incidents",
    routes: incidentsRoutes.records,
    context: provideContext(incidentsContextKey, { reporting: ref(false), appVersion: options.appVersion ?? "" }),
    navigation: options.destination ? [{ destination: options.destination, to: incidentsRoutes.index, within: ["incidents.details"] }] : [],
    contributions: [
      { id: "incidents.report-menu", slot: "accountMenu", component: ReportMenuItem, scope: "authenticated", order: 40, optional: true },
      { id: "incidents.report-host", slot: "host", component: ReportHost, scope: "authenticated", optional: true },
    ],
  });
}
