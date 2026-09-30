import { hasInjectionContext, inject, provide, shallowRef, watch, type InjectionKey } from "vue";
import { useRoute } from "vue-router";
import { MissingContextError } from "../platform/context";
import { positiveInteger, useResource, type IdentifyOption, type Resource, type ResourceBaseOptions, type ResourceId } from "./resource";

/** The record a routed page is about: a `Resource` whose identity is a route parameter. */
export type RouteResource<T, Id extends ResourceId = number> = Resource<T, Id>;

export interface RouteResourceOptions<T, Id extends ResourceId = number> extends Omit<ResourceBaseOptions<T, Id>, "for"> {
  /** Provides the resource to the page's routed sections (`useRouteResourceContext(key)`); declare it once in the feature's context file. */
  readonly key?: InjectionKey<RouteResource<T, Id>>;
  /** The route parameter that holds the identity (`"ticketID"` for `/tickets/:ticketID`). */
  readonly param: string;
}

/**
 * The record a routed page is about, from its route parameter: one typed lifecycle in place of a
 * `route.params` read, hand-made request versions and string refresh events.
 *
 *   // context.ts of the feature
 *   export const TICKET_RESOURCE: InjectionKey<RouteResource<Ticket>> = Symbol("ticket");
 *
 *   // the page
 *   const ticket = useRouteResource({ key: TICKET_RESOURCE, param: "ticketID", load: (id, { signal }) => api.get(id, { signal }) });
 *
 *   // a routed section
 *   const ticket = useRouteResourceContext(TICKET_RESOURCE);
 *   ticket.update(await api.save(ticket.id.value, values));   // or: await ticket.reload()
 *
 * - The identity is validated by `parse` (default: a positive safe integer); an invalid or missing
 *   one is `notFound` and never a request. Pass `parse` for other identities (a UUID).
 * - A parameter change clears the previous record and aborts its read; a response for a record the
 *   route has left is dropped. A save that finishes after the user moved on is ignored by `update`:
 *   the record says which one it is (its `id`, or `identify` when it has none).
 * - Once the route leaves the page (the parameter is gone while the page is still mounted, in a leave
 *   transition) the page keeps its record: nothing is read and nothing flashes "not found".
 * - Failure is told apart: `notFound` (404, or no such identity) and `unavailable` (retry).
 */
export function useRouteResource<T>(options: RouteResourceOptions<T> & IdentifyOption<T, number> & { readonly parse?: undefined }): RouteResource<T>;
export function useRouteResource<T, Id extends ResourceId>(
  options: RouteResourceOptions<T, Id> & IdentifyOption<T, Id> & { readonly parse: (raw: string) => Id | null },
): RouteResource<T, Id>;
export function useRouteResource<T, Id extends ResourceId>(
  options: RouteResourceOptions<T, Id> & { readonly identify?: (value: T) => Id; readonly parse?: (raw: string) => Id | null },
): RouteResource<T, Id> {
  const route = useRoute();
  const parse = options.parse ?? (positiveInteger as unknown as (raw: string) => Id | null);
  // The identity follows the parameter, except when the parameter disappears: the route has moved on and
  // this page is only still mounted (a leave transition), so it keeps showing its record instead of "not found".
  const identity = shallowRef<Id | null>(null);
  let started = false;
  watch(
    () => route.params[options.param],
    (raw) => {
      if (raw === undefined && started) return;
      started = true;
      const text = Array.isArray(raw) ? raw[0] : raw;
      identity.value = text === undefined ? null : parse(text);
    },
    { immediate: true, flush: "sync" },
  );
  const resource = useResource<T, Id>({ ...options, for: identity });
  if (options.key) provide(options.key, resource);
  return resource;
}

/** The page's resource inside one of its routed sections. Throws outside the page (a wiring mistake), naming the key. */
export function useRouteResourceContext<T, Id extends ResourceId = number>(key: InjectionKey<RouteResource<T, Id>>): RouteResource<T, Id> {
  const name = key.description ?? "route resource";
  if (!hasInjectionContext()) throw new MissingContextError(name, "outside-setup");
  const resource = inject(key, null);
  if (!resource) throw new MissingContextError(name, "not-provided");
  return resource;
}
