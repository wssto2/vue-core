import type { HttpClient } from "../../client";
import { readListPage } from "../../collection";
import { identityRoutes } from "../../modules/identity/routes";
import type { ServiceAccount, ApiKey, CreatedApiKey } from "../../modules/serviceaccount/entities";
import { serviceaccountRoutes } from "../../modules/serviceaccount/routes";
import type { KeyRequest, SaveInput } from "../../modules/serviceaccount/schemas";
import { usePlatform } from "../../platform";

type Options = { readonly signal?: AbortSignal };
const idempotent = (key: string) => ({ headers: { "Idempotency-Key": key } });

/** The most go-core's datatable answers in a page. */
const PEOPLE = 500;

/** go-core's service account routes as calls; `data` of each answer already read. A change takes the `Idempotency-Key` of its attempt. */
export function createServiceAccountsApi(http: HttpClient) {
  return {
    list: async (options?: Options): Promise<readonly ServiceAccount[]> => (await http.request(serviceaccountRoutes.index, undefined, options)).data.service_accounts,
    show: async (id: number, options?: Options): Promise<ServiceAccount> => (await http.request(serviceaccountRoutes.show, { id }, options)).data,
    create: async (input: SaveInput, idempotencyKey: string): Promise<ServiceAccount> => (await http.request(serviceaccountRoutes.create, input, idempotent(idempotencyKey))).data,
    update: async (id: number, input: SaveInput, idempotencyKey: string): Promise<ServiceAccount> => (await http.request(serviceaccountRoutes.update, { ...input, id }, idempotent(idempotencyKey))).data,
    deactivate: async (id: number): Promise<ServiceAccount> => (await http.request(serviceaccountRoutes.deactivate, { id })).data,
    keys: async (id: number, options?: Options): Promise<readonly ApiKey[]> => (await http.request(serviceaccountRoutes.keys, { id }, options)).data.keys,
    /** The secret is in the answer, and only there. */
    createKey: async (id: number, input: KeyRequest, idempotencyKey: string): Promise<CreatedApiKey> =>
      (await http.request(serviceaccountRoutes.createkey, { ...input, id }, idempotent(idempotencyKey))).data,
    revokeKey: async (id: number, keyID: number): Promise<void> => void (await http.request(serviceaccountRoutes.revokekey, { id, keyID })),
    /** The people who can answer for an account: the active ones of the users list (its largest page). */
    people: async (options?: Options): Promise<readonly { readonly id: number; readonly name: string }[]> =>
      readListPage(await http.request(identityRoutes.usersList, { view: "active", order_col: "name", order_dir: "asc", page: 1, per_page: PEOPLE }, options), { page: 1, pageSize: PEOPLE }).rows.map((person) => ({ id: person.id, name: person.name })),
  };
}

export type ServiceAccountsApi = ReturnType<typeof createServiceAccountsApi>;

/** The calls, over the platform's client; call it in `setup`. */
export const useServiceAccountsApi = (): ServiceAccountsApi => createServiceAccountsApi(usePlatform().http);
