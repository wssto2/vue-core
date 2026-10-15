import type { HttpClient } from "../client";
import { defineCollection, listParams, readListPage } from "../collection";
import type { CommentResponse, Incident, ReportResponse } from "../modules/incident/entities";
import { incidentRoutes } from "../modules/incident/routes";
import type { CommentRequest, ReportInput, UpdateRequest } from "../modules/incident/schemas";
import { usePlatform } from "../platform";

export type IncidentSort = "title" | "last_seen_at";
export type IncidentFilter = "created_at" | "status" | "severity" | "source";

/** The incident list: last seen first. Made over the platform's client, in `setup`; the list and the record's previous / next share its id. */
export function incidentList(http: HttpClient) {
  return defineCollection<Incident, IncidentSort, IncidentFilter>({
    id: "incidents",
    stateVersion: 1,
    load: async (query, { signal }) => readListPage<Incident>(await http.request(incidentRoutes.index, listParams(query), { signal }), query),
    key: (incident) => incident.id,
    query: { sorts: ["title", "last_seen_at"], filters: ["created_at", "status", "severity", "source"] },
    defaults: { sort: "last_seen_at", direction: "desc" },
  });
}

/** An incident's page: the incident, the user reports behind it and its comments, from one read. */
export interface IncidentDetail {
  readonly incident: Incident;
  readonly reports: readonly ReportResponse[];
  readonly comments: readonly CommentResponse[];
}

const idempotent = (key: string) => ({ headers: { "Idempotency-Key": key } });

/** go-core's incident routes as calls; `data` of each answer already read. A change takes the `Idempotency-Key` of its attempt. */
export function createIncidentsApi(http: HttpClient) {
  return {
    show: async (id: number, options?: { readonly signal?: AbortSignal }): Promise<IncidentDetail> => {
      const { data, meta } = await http.request(incidentRoutes.show, { incidentID: id }, options);
      return { incident: data, reports: meta?.reports ?? [], comments: meta?.comments ?? [] };
    },
    /** The whole management form; the answer is the stored incident (without its people: the page reads again for them). */
    update: async (id: number, input: UpdateRequest, idempotencyKey: string): Promise<Incident> =>
      (await http.request(incidentRoutes.update, { ...input, incidentID: id }, idempotent(idempotencyKey))).data,
    /** A report: the incident it opened or joined. */
    report: async (input: ReportInput, idempotencyKey: string): Promise<Incident> => (await http.request(incidentRoutes.report, input, idempotent(idempotencyKey))).data.data,
    comment: async (id: number, input: CommentRequest, idempotencyKey: string): Promise<CommentResponse> =>
      (await http.request(incidentRoutes.comment, { ...input, incidentID: id }, idempotent(idempotencyKey))).data,
  };
}

export type IncidentsApi = ReturnType<typeof createIncidentsApi>;

/** The calls, over the platform's client; call it in `setup`. */
export const useIncidentsApi = (): IncidentsApi => createIncidentsApi(usePlatform().http);
