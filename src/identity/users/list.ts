import type { HttpClient } from "../../client";
import { defineCollection, readListPage, type CollectionDefinition } from "../../collection";
import { identityRoutes } from "../../modules/identity/routes";
import { LastSignInFilterSchema } from "../../modules/identity/schemas";
import { usePlatform } from "../../platform";
import { useUsersContext } from "./context";

/** The views of the list, as go-core's `GET /v1/iam/users` knows them. */
export const USER_VIEWS = ["active", "locked", "inactive", "all"] as const;

/**
 * The definition of the people list that `usersFeature({ collection })` takes: any collection of people, with the sorts and
 * filters the application's server accepts. Its rows must carry what the screens read of a `UserRow`.
 */
// `any`: a collection is invariant in its row and keys, so one typed on the application's row (`UserRow & { dealer: string }`) is not assignable to a `UserRow` one.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UsersCollection = CollectionDefinition<any, any, any, any>;

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
          last_sign_in: LastSignInFilterSchema.safeParse(query.filters.last_sign_in).data,
        },
        { signal },
      );
      return readListPage(result, query);
    },
    key: (user) => user.id,
    query: { sorts: ["login", "name", "email", "created_at"], filters: ["last_sign_in"], views: USER_VIEWS },
    defaults: { sort: "name", direction: "asc", view: "active" },
  });
}

/**
 * The definition the users screens ask the list with: the application's (`usersFeature({ collection })`) or `userList`. The list
 * page and the previous / next of a record both call it, so they ask the server the same question.
 */
export function useUserList(): ReturnType<typeof userList> {
  const { collection } = useUsersContext();
  const { http } = usePlatform();
  return (collection as ReturnType<typeof userList> | undefined) ?? userList(http);
}
