import type { RouteRecordRaw } from "vue-router";
import { defineRoutes } from "../router";
import { VIEW_INCIDENTS } from "./access";

/**
 * The routes of `incidentsFeature`: typed targets for links (`incidentsRoutes.index`, `incidentsRoutes.details({ incidentID })`)
 * and the records the feature installs. The names and paths are fixed, so a link or a menu binding of the application can name them.
 */
export interface IncidentsRoutes {
  /** The records `incidentsFeature` installs. */
  readonly records: readonly RouteRecordRaw[];
  readonly index: { readonly name: "incidents.index" };
  readonly details: (params: { incidentID: string | number }) => { readonly name: "incidents.details"; readonly params: { incidentID: string | number } };
}

// Typed by hand: the inferred type would name the screens' modules in the published declarations.
export const incidentsRoutes: IncidentsRoutes = defineRoutes({
  index: { name: "incidents.index", path: "/incidents", component: () => import("./IncidentsList.vue"), meta: { access: VIEW_INCIDENTS, titleKey: "core.incidents.title" } },
  details: {
    name: "incidents.details",
    path: "/incidents/:incidentID",
    component: () => import("./IncidentRecord.vue"),
    // Previous / next record swaps the id in place.
    meta: { access: VIEW_INCIDENTS, titleKey: "core.incidents.title", remountOnParam: "incidentID" },
  },
});
