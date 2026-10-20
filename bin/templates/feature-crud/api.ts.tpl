import type { HttpClient } from "@wssto2/vue-core/client";
import { defineCollection, httpList } from "@wssto2/vue-core/collection";
import { __FEATURE_ROUTE_TABLE__ } from "@/generated/routes/__FEATURE_ROUTE_MODULE__/routes";
import type { __FEATURE_FORM_TYPE__ } from "./form";
import type { __FEATURE_ENTITY__ } from "./types";

export type __FEATURE_ENTITY__Sort = "name" | "created_at" | "updated_at";

// The requests are the route table go-core generates from the Go feature's Contract (ts:generate-routes): the ids
// are the URL's, the rest of the input is the body.
export const __FEATURE_API_CLIENT__ = (http: HttpClient) => ({
  list: httpList<__FEATURE_ENTITY__, __FEATURE_ENTITY__Sort, never>(http, __FEATURE_ROUTE_TABLE__.list.path),

  async get(id: number): Promise<__FEATURE_ENTITY__> {
    return (await http.request(__FEATURE_ROUTE_TABLE__.show, { id })).data;
  },

  /** A 422 lands on the form's fields (`form.submit`). */
  async create(payload: __FEATURE_FORM_TYPE__, idempotencyKey: string): Promise<__FEATURE_ENTITY__> {
    return (await http.request(__FEATURE_ROUTE_TABLE__.create, payload, { idempotencyKey })).data;
  },
});

export type __FEATURE_ENTITY__Api = ReturnType<typeof __FEATURE_API_CLIENT__>;

/** The list: the list page and a record's previous / next both read this one definition. */
export const __FEATURE_LIST__ = (api: __FEATURE_ENTITY__Api) =>
  defineCollection({
    id: "__FEATURE_I18N_MODULE__",
    stateVersion: 1,
    load: api.list,
    key: (item: __FEATURE_ENTITY__) => item.id ?? 0, // generated entities type `id` as nullable
    query: { sorts: ["name", "created_at", "updated_at"], filters: [] },
    defaults: { sort: "created_at", direction: "asc" },
  });
