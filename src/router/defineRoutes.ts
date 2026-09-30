import type { RouteRecordRaw } from "vue-router";

/** A route record that can be navigated to by name: `name` and `path` are required. */
export type RouteDefinition = RouteRecordRaw & { name: string; path: string };

// --- the parameters a path declares, read from the literal type of `path`

/** `:id`, `:id?`, `:id(\\d+)`, `:slug+`, also in the middle of a segment (`/file-:name.:ext`): name + whether optional. */
type Tokens<P extends string> = P extends `${string}:${infer Rest}` ? TokenOf<Rest> : never;
type Cut<S extends string, Stop extends string> = S extends `${infer Head}${Stop}${string}` ? Head : S;
type NameOf<S extends string> = Cut<Cut<Cut<Cut<Cut<Cut<Cut<Cut<S, "(">, "?">, "+">, "*">, "-">, ".">, "/">, ":">;
type TokenOf<Rest extends string> = Rest extends `${NameOf<Rest>}${infer After}`
  ? (NameOf<Rest> extends "" ? never : [NameOf<Rest>, Modifier<After>]) | Tokens<After>
  : never;
type WithoutPattern<S extends string> = S extends `(${string})${infer Tail}` ? Tail : S;
type Modifier<After extends string> = WithoutPattern<After> extends `?${string}` | `*${string}` ? true : false;

type RequiredNames<T> = T extends [infer Name extends string, false] ? Name : never;
type OptionalNames<T> = T extends [infer Name extends string, true] ? Name : never;
type Flatten<T> = { [K in keyof T]: T[K] } & {};

/** The parameters of a path: `"/tickets/:ticketID"` is `{ ticketID: string | number }`. */
export type RouteParams<P extends string> = Flatten<
  { [K in RequiredNames<Tokens<P>>]: string | number } & { [K in OptionalNames<Tokens<P>>]?: string | number }
>;

type Target<Name extends string, P extends string> = [Tokens<P>] extends [never]
  ? { readonly name: Name }
  : [RequiredNames<Tokens<P>>] extends [never]
    ? (params?: RouteParams<P>) => { readonly name: Name; readonly params: RouteParams<P> }
    : (params: RouteParams<P>) => { readonly name: Name; readonly params: RouteParams<P> };

/** What `defineRoutes` returns for one definition: a value for a path without parameters, otherwise a function of them. */
export type RouteTarget<D> = D extends { name: infer Name extends string; path: infer P extends string } ? Target<Name, P> : never;

export type DefinedRoutes<R extends Record<string, RouteDefinition>> = {
  /** The ordinary Vue Router records, to hand to `defineFeature({ routes })` or `createRouter`. */
  readonly records: readonly RouteRecordRaw[];
} & { readonly [Key in keyof R]: RouteTarget<R[Key]> };

const hasParameters = (path: string) => /:[A-Za-z0-9_]/.test(path);

function* names(records: readonly RouteRecordRaw[]): Generator<string> {
  for (const record of records) {
    if (typeof record.name === "string") yield record.name;
    if (record.children) yield* names(record.children);
  }
}

/**
 * Declares routes once and gets both the ordinary Vue Router records and typed targets for them:
 *
 *   export const ticketRoutes = defineRoutes({
 *     index: { name: "tickets.index", path: "/tickets", component: () => import("./views/Index.vue") },
 *     record: { name: "tickets.record", path: "/tickets/:ticketID", component: () => import("./views/Details.vue") },
 *   });
 *
 *   router.push(ticketRoutes.index);                       // no parameters: a value
 *   router.push(ticketRoutes.record({ ticketID: 12 }));    // parameters: a function; a wrong or missing one does not compile
 *   createFeature({ routes: ticketRoutes.records });
 *
 * The compiler checks which parameters a route has, not what their values are (URL parameters are
 * parsed at runtime). Only the top-level routes get a target; nested ones (record sections) are
 * reached by name. Throws when two routes of one declaration share a name.
 */
export function defineRoutes<const R extends Record<string, RouteDefinition> & { records?: never }>(routes: R): DefinedRoutes<R> {
  const records = Object.values(routes) as unknown as RouteRecordRaw[];
  const seen = new Set<string>();
  for (const name of names(records)) {
    if (seen.has(name)) throw new Error(`defineRoutes: the route name "${name}" is used twice in one declaration.`);
    seen.add(name);
  }

  const targets: Record<string, unknown> = {};
  for (const [key, definition] of Object.entries(routes)) {
    targets[key] = hasParameters(definition.path) ? (params?: object) => ({ name: definition.name, params: params ?? {} }) : { name: definition.name };
  }
  return { ...targets, records } as DefinedRoutes<R>;
}
