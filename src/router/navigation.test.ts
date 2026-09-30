import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { createSession, type NavigationNode } from "../platform";
import { snapshotOf } from "../platform/testing";
import { bindNavigation, createNavigation, type OwnedNavigationBinding } from "./navigation";
import { defineRoutes } from "./defineRoutes";

const view = { render: () => null };
const routes = defineRoutes({
  tickets: { name: "tickets.index", path: "/tickets", component: view },
  ticket: { name: "tickets.record", path: "/tickets/:ticketID", component: view, children: [{ name: "tickets.general", path: "general", component: view }] },
  reports: { name: "reports.index", path: "/reports", component: view },
});

const bind = (feature: string, destination: string, to: OwnedNavigationBinding["binding"]["to"], within?: string[]): OwnedNavigationBinding => ({
  feature,
  binding: { destination, to, ...(within && { within }) },
});

describe("bindNavigation", () => {
  it("accepts one binding per destination", () => {
    const { destinations, issues } = bindNavigation([bind("tickets", "tickets", routes.tickets), bind("reports", "reports", routes.reports)]);
    expect(issues).toEqual([]);
    expect([...destinations.keys()]).toEqual(["tickets", "reports"]);
  });

  it("names both owners of a destination bound twice", () => {
    const { issues } = bindNavigation([bind("tickets", "tickets", routes.tickets), bind("legacy", "tickets", routes.reports)]);
    expect(issues).toEqual(['The destination "tickets" is bound twice: by feature "tickets" and by feature "legacy".']);
  });

  it("checks bindings against the backend's catalogue, and demands the required ones", () => {
    const { issues } = bindNavigation([bind("tickets", "tickest", routes.tickets)], { known: ["tickets", "reports"], required: ["home"] });
    expect(issues).toEqual([
      'Feature "tickets" binds the destination "tickest", which the backend\'s navigation does not contain.',
      'The destination "home" is required but no feature binds it.',
    ]);
  });
});

describe("createNavigation", () => {
  const tree: NavigationNode[] = [
    { i18n: "navigation.work", children: [{ i18n: "navigation.tickets", icon: "box", route: "tickets" }, { i18n: "navigation.reports", route: "reports" }] },
    { i18n: "navigation.admin", children: [{ i18n: "navigation.users", route: "users" }] },
    { i18n: "navigation.home", route: "home" },
  ];

  async function setup(bindings: OwnedNavigationBinding[], navigation: readonly NavigationNode[] = tree) {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/", component: view }, ...routes.records] });
    await router.push("/");
    const session = createSession({ load: async () => ({ ...snapshotOf(1), navigation }), signOut: async () => {} });
    await session.restore();
    const labels: Record<string, string> = { "navigation.tickets": "Tickets", "navigation.work": "Work" };
    const items = createNavigation({
      session,
      router,
      i18n: { te: (key) => key in labels, t: (key) => labels[key] ?? key },
      destinations: bindNavigation(bindings).destinations,
    });
    return { router, session, items };
  }

  it("resolves the server's tree through the bindings: labels, icons and targets", async () => {
    const { items } = await setup([bind("tickets", "tickets", routes.tickets), bind("reports", "reports", routes.reports)]);

    expect(items.value).toMatchObject([
      {
        label: "Work",
        to: null,
        children: [
          { label: "Tickets", icon: "box", to: { name: "tickets.index" } },
          { label: "navigation.reports", icon: null, to: { name: "reports.index" } }, // an untranslated key stays visible as itself
        ],
      },
    ]);
  });

  it("leaves out a destination nobody bound, and a group left empty, so there is never a broken link", async () => {
    const { items } = await setup([bind("tickets", "tickets", routes.tickets)]); // reports, users, home are not installed

    expect(items.value).toHaveLength(1);
    expect(items.value[0]!.children.map((child) => child.label)).toEqual(["Tickets"]);
  });

  it("marks the destination of the current page, also through `within` and for a group over it", async () => {
    const { items, router } = await setup([bind("tickets", "tickets", routes.tickets, ["tickets.record"]), bind("reports", "reports", routes.reports)]);

    expect(items.value[0]!.active).toBe(false);
    await router.push("/tickets");
    expect(items.value[0]!.children.map((child) => child.active)).toEqual([true, false]);
    expect(items.value[0]!.active).toBe(true);

    await router.push(routes.ticket({ ticketID: 5 }));
    expect(items.value[0]!.children.map((child) => child.active)).toEqual([true, false]); // a record page keeps its list highlighted
    await router.push("/reports");
    expect(items.value[0]!.children.map((child) => child.active)).toEqual([false, true]);
  });

  it("is empty while nobody is signed in, and follows the session", async () => {
    const { items, session } = await setup([bind("tickets", "tickets", routes.tickets)]);
    expect(items.value).toHaveLength(1);

    await session.signOut();
    expect(items.value).toEqual([]);
  });

  it("a session without a menu has none", async () => {
    const { items } = await setup([bind("tickets", "tickets", routes.tickets)], []);
    expect(items.value).toEqual([]);
  });
});
