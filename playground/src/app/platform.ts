// A platform over a fake backend: one sign-in (Ana, who may view tickets and reports) and a menu tree
// naming two destinations. Every call builds an independent one.
import type { Transport } from "@wssto2/vue-core/client";
import { createPlatform, parseBootstrap } from "@wssto2/vue-core/platform";
import { serveLists } from "./features/crmdata/serve";

declare module "@wssto2/vue-core/platform" {
  // The permission catalogue: route meta and `access` narrow to it.
  interface PermissionRegistry {
    "tickets:view": true;
    "reports:view": true;
  }
}

declare module "@wssto2/vue-core/router" {
  // The destinations of the backend's menu.
  interface DestinationRegistry {
    tickets: true;
    reports: true;
  }
}

export function createDemoPlatform() {
  let signedIn = false;
  const transport: Transport = async (url, init) => {
    if (url.endsWith("/auth/me") && signedIn) {
      return new Response(
        JSON.stringify({
          user: { id: 1 },
          expires_at: new Date(Date.now() + 3_600_000).toISOString(),
          navigation: [
            { i18n: "nav.work", children: [{ i18n: "nav.tickets", route: "tickets" }, { i18n: "nav.reports", route: "reports" }, { i18n: "nav.customers", route: "customers" }, { i18n: "nav.leads", route: "leads" }] },
          ],
          access: {
            root: false,
            permissions: {
              "tickets:view": { scope: { level: "organization" }, qualifier: "all", clauses: [] },
              "reports:view": { scope: { level: "organization" }, qualifier: "all", clauses: [] },
              "customers:view": { scope: { level: "organization" }, qualifier: "all", clauses: [] },
              "customers:create": { scope: { level: "organization" }, qualifier: "all", clauses: [] },
              "leads:view": { scope: { level: "organization" }, qualifier: "all", clauses: [] },
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
  });
}
