// What an application's composition root does with @wssto2/vue-core/client and /platform: a validated bootstrap
// config with the app's own section, a platform over a custom transport and session adapter, typed permissions.
import { ApiError, isAborted, type Transport } from "@wssto2/vue-core/client";
import {
  createPlatform,
  defineFeatureContext,
  httpSessionAdapter,
  parseBootstrap,
  type AccessClient,
} from "@wssto2/vue-core/platform";

export type AppPermission = "tickets:view" | "tickets:update";

interface AppUser {
  readonly id: number;
  readonly name: string;
}

// The server embeds this in the page; readBootstrap() reads it from <script id="app-state">.
const config = parseBootstrap({ locale: "en", api_base: "/api/v1", app_name: "Playground", currency: "EUR" }, (fields) => ({
  currency: fields.string("currency"),
}));

// A fake backend, standing in for fetch.
const transport: Transport = async (url) => {
  if (url.endsWith("/auth/me")) {
    return new Response(
      JSON.stringify({
        user: { id: 1, name: "Ana" },
        access: { root: false, permissions: { "tickets:view": { scope: { level: "organization" }, qualifier: "all", clauses: [] } } },
      }),
    );
  }
  return new Response(JSON.stringify({ success: false, error: "not found" }), { status: 404 });
};

export const platform = createPlatform({
  config,
  transport,
  session: (http) =>
    httpSessionAdapter(http, {
      parseUser: (raw): AppUser => {
        const { id, name } = raw as AppUser;
        return { id, name };
      },
    }),
});

export const access: AccessClient<AppPermission> = platform.access;

export const [TICKETS, useTickets] = defineFeatureContext<{ readonly access: AccessClient<AppPermission> }>("playground.tickets");

export async function describeSession(): Promise<string> {
  try {
    const state = await platform.session.restore();
    await platform.http.get("/tickets");
    return state.status === "authenticated" ? `${state.user.name} ${access.can("tickets:view")}` : state.status;
  } catch (error) {
    if (isAborted(error)) return "aborted";
    return error instanceof ApiError ? error.kind : "unexpected";
  }
}
