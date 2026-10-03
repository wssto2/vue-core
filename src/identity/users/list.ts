import type { HttpClient } from "../../client";
import { defineCollection, readListPage } from "../../collection";
import { identityRoutes } from "../../modules/identity/routes";

/** The views of the list, as go-core's `GET /v1/iam/users` knows them. */
export const USER_VIEWS = ["active", "locked", "inactive", "all"] as const;

/**
 * The list of people, one definition for the list page and for the previous / next of a person's record, so both ask
 * the server the same question. The sorts and views are the ones go-core accepts.
 */
export function userList(http: HttpClient) {
  return defineCollection({
    id: "identity.users",
    stateVersion: 1,
    load: async (query, { signal }) => {
      const result = await http.request(
        identityRoutes.usersList,
        {
          view: query.view ?? undefined,
          search: query.search || undefined,
          order_col: query.sort ?? undefined,
          order_dir: query.sort ? query.direction : undefined,
          page: query.page,
          per_page: query.pageSize,
        },
        { signal },
      );
      return readListPage(result, query);
    },
    key: (user) => user.id,
    query: { sorts: ["login", "name", "email", "created_at"], filters: [], views: USER_VIEWS },
    defaults: { sort: "name", direction: "asc", view: "active" },
  });
}
