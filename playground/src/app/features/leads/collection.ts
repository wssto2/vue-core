import { defineCollection } from "@wssto2/vue-core/collection";
import type { LeadsApi } from "./api";

export function createLeadList(api: LeadsApi) {
  return defineCollection({
    id: "crm.leads",
    stateVersion: 1,
    load: api.list,
    key: (lead) => lead.id,
    // What the backend can sort and filter by: declared here, not read off the DTO.
    query: { sorts: ["created_at", "first_name"], filters: ["phase", "assigned_to", "followup", "created_at"], views: ["all", "mine"] },
    defaults: { sort: "created_at", direction: "desc" },
  });
}
