// Code that runs outside a component's setup reaches the application through currentApplication().
import { currentApplication } from "@wssto2/vue-core/app";
import { defineCollection, listLoader } from "@wssto2/vue-core/collection";
import { found, readRecord } from "@wssto2/vue-core/resource";

export interface Dealer {
  id: number;
  name: string;
}

// Declared at module level, before the application exists: the client is read when the call is made.
export const dealers = defineCollection({ id: "dealers", stateVersion: 1, load: listLoader<Dealer>("/v1/dealers"), key: (dealer) => dealer.id });
export const dealerRecord = (id: number, context: { signal: AbortSignal }) => readRecord<Dealer | null>(`/v1/dealers/${id}`, context).then(found);

export const archive = (id: number) => currentApplication().platform.http.post(`/v1/dealers/${id}/archive`, {});

// A failure the code caught, and the user saw: a handled error goes to the incidents (and the console), with where it happened.
export function restoreLayout(): unknown {
  try {
    return JSON.parse(localStorage.getItem("layout") ?? "null");
  } catch (error) {
    currentApplication().report(error, { detail: "layout-restore" });
    return null;
  }
}
