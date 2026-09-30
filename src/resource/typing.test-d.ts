// Type fixtures, checked by `npm run typecheck` (vue-tsc): positive cases must compile, every
// `@ts-expect-error` line must fail to. Nothing here runs.
import type { InjectionKey } from "vue";
import type { AsyncState } from "../state";
import { useResource, type ResourceState } from "./resource";
import { useRouteResource, useRouteResourceContext, type RouteResource } from "./routeResource";

interface Ticket {
  readonly id: number;
  readonly subject: string;
}
interface Dealer {
  readonly id: number;
  readonly name: string;
}
interface Note {
  readonly text: string;
}
declare function loadTicket(id: number): Promise<Ticket>;
declare function loadDealer(id: number): Promise<Dealer>;
declare function loadNote(id: number): Promise<Note>;
declare function loadByUuid(id: string): Promise<{ readonly id: string }>;

const TICKET: InjectionKey<RouteResource<Ticket>> = Symbol("ticket");

// --- positive: the record type flows from the loader; an `id` identifies it by itself
export const ticket: RouteResource<Ticket> = useRouteResource({ key: TICKET, param: "ticketID", load: loadTicket });
export const subject: string | undefined = ticket.data.value?.subject;
export const section: RouteResource<Ticket> = useRouteResourceContext(TICKET);

// --- positive: a loader written as a lambda (its parameters typed by the context, its record by what it returns), with or without a key
declare const api: { get(id: number, options?: { signal?: AbortSignal }): Promise<{ data: Ticket }> };
export const fromLambda: RouteResource<Ticket> = useRouteResource({ param: "ticketID", load: (id, { signal }) => api.get(id, { signal }).then((response) => response.data) });
export const fromKeyedLambda: RouteResource<Ticket> = useRouteResource({ key: TICKET, param: "ticketID", load: (id) => api.get(id).then((response) => response.data) });

// --- positive: another identity through `parse`; a record without an `id` says which one it is
export const byUuid: RouteResource<{ readonly id: string }, string> = useRouteResource({ param: "accountID", parse: (raw) => raw || null, load: loadByUuid });
export const note: RouteResource<Note> = useRouteResource({ param: "noteID", load: loadNote, identify: () => 1 });

// --- positive: a state is an AsyncState, so AsyncSection takes it as it is; a loaded one has its value non-null
export const asyncState: AsyncState<Ticket> = ticket.state.value;
export function valueOfLoaded(state: ResourceState<Ticket>): Ticket | null {
  return state.status === "loaded" ? state.value : null;
}

// --- negative
// @ts-expect-error a context key of one record type cannot take a loader of another
useRouteResource({ key: TICKET, param: "ticketID", load: loadDealer });

// @ts-expect-error a record without an `id` needs `identify`
useRouteResource({ param: "noteID", load: loadNote });

// @ts-expect-error a parser of another identity type than the loader takes
useRouteResource({ param: "ticketID", parse: (raw: string) => raw, load: loadTicket });

// @ts-expect-error a context of a ticket is not a context of a dealer
export const wrong: RouteResource<Dealer> = useRouteResourceContext(TICKET);

// @ts-expect-error the state of a resource is not loaded until its status says so: `value` does not exist on every state
export const unchecked: Ticket = ticket.state.value.value;

// --- a region that loads on its own takes the identity of its record
export const comments = useResource({ for: () => ticket.id.value, load: async (id) => [`comment of ${id}`] });
