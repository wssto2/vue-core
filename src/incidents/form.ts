import type { FormValidator } from "../form";
import type { CommentRequest, ReportInput, UpdateRequest } from "../modules/incident/schemas";
import type { IncidentDetail } from "./api";

/** A validator that refuses the named text fields while they are blank; the server's own bounds (go-core's `max:`) apply on top. */
export function requiredText<Values extends object>(fields: readonly (keyof Values & string)[], message: string): FormValidator<Values> {
  return {
    safeParse(input) {
      const values = input as Record<string, unknown>;
      const issues = fields.filter((field) => String(values[field] ?? "").trim() === "").map((field) => ({ path: [field], message }));
      return issues.length > 0 ? { success: false, error: { issues } } : { success: true, data: input as Values };
    },
  };
}

/** The report: the page and the browser are filled when the dialog opens. */
export type ReportForm = ReportInput;

export function reportFormDefaults(appVersion: string): ReportForm {
  return {
    title: "",
    description: "",
    steps_to_reproduce: "",
    expected_result: "",
    actual_result: "",
    severity: "medium",
    affected_module: "",
    page_url: window.location.pathname,
    browser_info: window.navigator.userAgent,
    app_version: appVersion,
    frontend_error_message: "",
    frontend_stacktrace: "",
    attachment_json: "",
    extra_json: "",
  };
}

/** A comment: its text and who may read it. */
export type CommentForm = CommentRequest;
export const commentFormDefaults = (): CommentForm => ({ body: "", visibility: "public" });

/** What the management fields edit: every key of the update, the two ids nullable. */
export type ManagementDraft = Required<UpdateRequest>;

export function managementDefaults(): ManagementDraft {
  return {
    status: "",
    severity: "",
    visibility: "",
    assigned_to_user_id: null,
    duplicate_of_incident_id: null,
    resolution_summary: "",
    external_ticket_provider: "",
    external_ticket_id: "",
    external_ticket_url: "",
  };
}

/** The incident as the management fields' draft: the update sends back what the incident has, the empty values as the form states them. */
export function managementDraft({ incident }: IncidentDetail): ManagementDraft {
  return {
    status: incident.status,
    severity: incident.severity,
    visibility: incident.visibility,
    assigned_to_user_id: incident.assigned_to_user_id ?? null,
    duplicate_of_incident_id: incident.duplicate_of_incident_id ?? null,
    resolution_summary: incident.resolution_summary ?? "",
    external_ticket_provider: incident.external_ticket_provider || "none",
    external_ticket_id: incident.external_ticket_id ?? "",
    external_ticket_url: incident.external_ticket_url ?? "",
  };
}
