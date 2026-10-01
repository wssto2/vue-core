// Type fixtures, checked by `npm run typecheck` (vue-tsc): positive cases must compile, every
// `@ts-expect-error` line must fail to. Nothing here runs.
import { createApp } from "vue";
import { createHttpClient, type ApiErrorKind, type HttpClient, type Transport } from "../client";
import { createPlatform, defineFeatureContext, type AccessGateProps, httpSessionAdapter, parseBootstrap, type AccessClient, type SessionAdapter } from "./index";

const config = parseBootstrap({ locale: "hr", country: "HR" }, (fields) => ({ country: fields.string("country") }));

// --- positive: a custom transport, including fetch itself, fits
export const viaFetch: Transport = fetch;
export const viaMock: Transport = async (_url, init) => new Response(JSON.stringify({ method: init.method }));

// --- positive: a custom session adapter with the application's own user type flows through the platform
interface AppUser {
  readonly id: number;
  readonly name: string;
}
const adapter: SessionAdapter<AppUser> = {
  load: async () => ({ user: { id: 1, name: "Ana" }, expiresAt: null, access: { root: false, permissions: {}, unavailable: [] } }),
  signOut: async () => {},
};
export const custom = createPlatform({ config, transport: viaMock, session: adapter });
const state = custom.session.state.value;
if (state.status === "authenticated") {
  const name: string = state.user.name; // narrowed by status, typed from the adapter
  const country: string = custom.config.country; // the application's config section
  void [name, country];
}

// --- positive: the default session adapter gives the minimal user; a parser widens it
export const plain = createPlatform({ config });
export const plainId: number | string | undefined = plain.session.state.value.status === "authenticated" ? plain.session.state.value.user.id : undefined;
export const parsed = createPlatform({
  config,
  session: (http: HttpClient) => httpSessionAdapter(http, { parseUser: (raw): AppUser => raw as AppUser }),
});
export const parsedName: string | undefined = parsed.session.state.value.status === "authenticated" ? parsed.session.state.value.user.name : undefined;

// --- positive: the application narrows permissions to its own catalogue
type AppPermission = "crm.lead:view" | "crm.lead:update";
export const access: AccessClient<AppPermission> = plain.access;
access.can("crm.lead:view");
access.can("crm.lead:view", { level: "dealer", id: 3 });
access.canAny(["crm.lead:view", "crm.lead:update"]);

// --- negative: misuse fails to compile
// @ts-expect-error a typo in a permission of the application's catalogue
access.can("crm.lead:vieww");
// @ts-expect-error a permission is a string
access.can(42);
// @ts-expect-error config is required
createPlatform({});
// @ts-expect-error config must be a bootstrap config (locale, apiBase, ...)
createPlatform({ config: { locale: "hr" } });
// @ts-expect-error an adapter without signOut
export const noSignOut: SessionAdapter = { load: async () => null };
// @ts-expect-error the user of a snapshot must have an id
export const noId: SessionAdapter<{ name: string }> = { load: async () => null, signOut: async () => {} };
// @ts-expect-error a transport returns a Response
export const badTransport: Transport = async () => ({ status: 200 });
// @ts-expect-error a transport takes the url as a string
export const badTransportArgs: Transport = async (_url: number) => new Response();
// @ts-expect-error the custom adapter's user has no `email`
void (custom.session.state.value.status === "authenticated" && custom.session.state.value.user.email);
// @ts-expect-error a query value is a scalar or a list of scalars
createHttpClient().get("/x", { query: { filter: { a: 1 } } });
// @ts-expect-error a parser-less adapter for a non-minimal user cannot be typed as it
export const widened: SessionAdapter<AppUser> = httpSessionAdapter(createHttpClient());

// --- the error kinds are a closed set: a switch over them is checked for exhaustiveness
export function describeKind(kind: ApiErrorKind): string {
  switch (kind) {
    case "validation":
    case "unauthorized":
    case "forbidden":
    case "notFound":
    case "conflict":
    case "rejected":
    case "server":
    case "network":
    case "aborted":
    case "malformed":
      return kind;
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
}

// --- a feature context is typed on both sides
interface Dependencies {
  readonly api: { load(id: number): Promise<string> };
}
const [TICKETS, useTickets] = defineFeatureContext<Dependencies>("helpdesk.tickets");
const app = createApp({});
app.provide(TICKETS, { api: { load: async () => "" } });
// @ts-expect-error the provided value must match the context's type
app.provide(TICKETS, { api: 1 });
export const loaded: Promise<string> = useTickets().api.load(1);
// @ts-expect-error the context has no such member
void useTickets().missing;

// --- the access gate takes exactly one requirement
export const oneGate: AccessGateProps = { permission: "tickets:view" };
export const anyGate: AccessGateProps = { any: ["a", "b"] };
// @ts-expect-error two requirements at once are rejected
export const twoGates: AccessGateProps = { permission: "a", all: ["b"] };
// @ts-expect-error no requirement is rejected
export const noGate: AccessGateProps = {};
