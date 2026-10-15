// Fixtures for this folder's tests; the declaration build excludes it.
import { jsonResponse } from "../testing";
import type { CommentResponse, Incident, ReportResponse } from "../modules/incident/entities";
import { startScreen, type ScreenOptions } from "../identity/testing";
import { incidentsFeature, type IncidentsFeatureOptions } from "./feature";

export const INCIDENT_VIEW = "incident:view";
export const INCIDENT_CREATE = "incident:create";
export const INCIDENT_UPDATE = "incident:update";
export const INCIDENT_MANAGE = "incident:manage";

export const ana = { id: 7, name: "Ana Anić", email: "ana@example.test" };
export const ivan = { id: 4, name: "Ivan Horvat", email: "ivan@example.test" };

export const incident = (extra: Partial<Incident> = {}): Incident => ({
  id: 12,
  public_code: "INC-000012",
  source: "mixed",
  status: "new",
  severity: "high",
  visibility: "reporter_and_staff",
  title: "Invoice export fails",
  description: "The export ends in an error page.",
  affected_module: "billing",
  affected_route: "/v1/invoices/export",
  environment: "production",
  error_class: "sql.ErrConnDone",
  error_message_sample: "connection is already closed",
  stacktrace_sample: "goroutine 1 [running]:\nmain.export()",
  first_seen_at: "2026-10-01T08:00:00Z",
  last_seen_at: "2026-10-14T09:30:00Z",
  occurrence_count: 14,
  report_count: 1,
  comment_count: 2,
  reporter_user_id: ana.id,
  assigned_to_user_id: ivan.id,
  external_ticket_provider: "none",
  created_at: "2026-10-01T08:00:00Z",
  updated_at: "2026-10-14T09:30:00Z",
  reporter: ana,
  assignee: ivan,
  ...extra,
});

export const report = (extra: Partial<ReportResponse> = {}): ReportResponse => ({
  id: 3,
  incident_id: 12,
  reported_by_user_id: ana.id,
  report_type: "bug",
  status: "linked",
  title: "Export does not work",
  description: "I press Export and get an error.",
  steps_to_reproduce: "Open invoices, press Export",
  severity: "high",
  created_at: "2026-10-01T08:05:00Z",
  updated_at: "2026-10-01T08:05:00Z",
  reporter: ana,
  ...extra,
});

export const comment = (extra: Partial<CommentResponse> = {}): CommentResponse => ({
  id: 5,
  incident_id: 12,
  author_user_id: ivan.id,
  visibility: "public",
  body: "We are looking into it.",
  created_at: "2026-10-02T10:00:00Z",
  updated_at: "2026-10-02T10:00:00Z",
  author: ivan,
  ...extra,
});

/** The answer of `GET /v1/incidents/:id`: the incident, with its reports and comments in the meta. */
export const shown = (record: Incident = incident(), extra: { reports?: ReportResponse[]; comments?: CommentResponse[] } = {}) =>
  jsonResponse(200, { success: true, data: record, meta: { reports: extra.reports ?? [report()], comments: extra.comments ?? [comment()], watching: false } });

/** The incident screens (and the account menu's row) on a fake server. */
export function startIncidents(options: Omit<ScreenOptions, "features"> & { feature?: IncidentsFeatureOptions }) {
  const { feature, ...rest } = options;
  return startScreen({ ...rest, features: [incidentsFeature(feature)] });
}
