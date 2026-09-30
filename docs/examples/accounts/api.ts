import type { HttpClient } from "@wssto2/vue-core/client";

export interface Account {
  readonly id: number;
  readonly name: string;
  readonly plan: string;
  readonly active: boolean;
}

export interface ActivityEntry {
  readonly id: number;
  readonly at: string;
  readonly text: string;
}

export function createAccountsApi(http: HttpClient) {
  return {
    get: (id: number, signal: AbortSignal) => http.get<Account>(`/accounts/${id}`, { signal }).then((result) => result.data),
    activity: (id: number, signal: AbortSignal) => http.get<ActivityEntry[]>(`/accounts/${id}/activity`, { signal }).then((result) => result.data),
  };
}

export type AccountsApi = ReturnType<typeof createAccountsApi>;
