// go-core's incident module: the types and the route table of its HTTP contract (src/modules/incident, committed from
// go-core by `npm run modules:sync`; the input schemas as types only, under `Inputs`), the screens built on it and the
// reporter of the browser's own errors.
export type { CommentResponse as IncidentComment, Incident, Meta as IncidentMeta, PersonResponse as IncidentPerson, ReportResponse as IncidentReport } from "../modules/incident/entities";
export type * as Inputs from "../modules/incident/schemas";
export { incidentRoutes } from "../modules/incident/routes";
export { incidentsFeature } from "./feature";
export type { IncidentsFeatureOptions } from "./feature";
export { incidentsRoutes } from "./routes";
export type { IncidentsRoutes } from "./routes";
export { clientErrorReporter, MAX_REPORTS_PER_SESSION } from "./clientErrorReporter";
export type { ClientErrorReporterOptions } from "./clientErrorReporter";
