// A platform over a fake backend: one sign-in (Ana, who may view tickets and reports) and a menu tree
// naming two destinations. Every call builds an independent one.
import type { Transport } from "@wssto2/vue-core/client";
import { createPlatform, httpSessionAdapter, parseBootstrap, type SessionUser } from "@wssto2/vue-core/platform";
import { serveLists } from "./features/crmdata/serve";

declare module "@wssto2/vue-core/platform" {
  // The permission catalogue: route meta and `access` narrow to it.
  interface PermissionRegistry {
    "tickets:view": true;
    "reports:view": true;
    "records:view": true;
    "records:settings": true;
    "records:audit": true; // the demo user does not hold this one: the dealer's audit section stays out of its navigation
  }
}

declare module "@wssto2/vue-core/router" {
  // The destinations of the backend's menu.
  interface DestinationRegistry {
    tickets: true;
    reports: true;
    records: true;
  }
}

/** The application's own user: what its session adapter produces, and what the shell's `identity` is typed with. */
export interface Employee extends SessionUser {
  readonly name: string;
  readonly email: string;
}

const parseEmployee = (raw: unknown): Employee => {
  const user = raw as { id: number; name: string; email: string };
  return { id: user.id, name: user.name, email: user.email };
};

export function createDemoPlatform() {
  let signedIn = false;
  const transport: Transport = async (url, init) => {
    if (url.endsWith("/auth/me") && signedIn) {
      return new Response(
        JSON.stringify({
          user: { id: 1, name: "Ana Anić", email: "ana@example.com" },
          expires_at: new Date(Date.now() + 3_600_000).toISOString(),
          navigation: [
            { i18n: "nav.work", children: [{ i18n: "nav.tickets", route: "tickets", icon: "carLine" }, { i18n: "nav.reports", route: "reports", icon: "fileTextLine" }, { i18n: "nav.records", route: "records", icon: "box2Line" }, { i18n: "nav.customers", route: "customers" }, { i18n: "nav.leads", route: "leads" }, { i18n: "forms.nav", route: "forms" }, { i18n: "tools.nav", route: "tools" }] },
            { i18n: "workflows.nav", route: "workflows" },
          ],
          access: {
            root: false,
            permissions: {
              "tickets:view": { scope: { level: "organization" }, qualifier: "all", clauses: [] },
              "reports:view": { scope: { level: "organization" }, qualifier: "all", clauses: [] },
              "customers:view": { scope: { level: "organization" }, qualifier: "all", clauses: [] },
              "customers:create": { scope: { level: "organization" }, qualifier: "all", clauses: [] },
              "leads:view": { scope: { level: "organization" }, qualifier: "all", clauses: [] },
              "records:view": { scope: { level: "organization" }, qualifier: "all", clauses: [] },
              "records:settings": { scope: { level: "organization" }, qualifier: "all", clauses: [] },
            },
          },
        }),
      );
    }
    if (url.endsWith("/auth/login") && init.method === "POST") {
      signedIn = true;
      return new Response(JSON.stringify({ success: true }));
    }
    if (url.endsWith("/auth/logout")) signedIn = false;
    if (signedIn) {
      const list = await serveLists(url, init); // the customers and leads of the fake backend
      if (list) return list;
    }
    return new Response(JSON.stringify({ success: false, error: "unauthorized" }), { status: 401 });
  };

  return createPlatform({
    config: parseBootstrap({ locale: "en", app_name: "Playground", api_base: "/api/v1", capabilities: ["tickets", "customers", "leads"] }),
    transport,
    session: (http) => httpSessionAdapter(http, { parseUser: parseEmployee }),
  });
}
