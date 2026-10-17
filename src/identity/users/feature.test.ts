import { fireEvent, screen } from "@testing-library/vue";
import { defineComponent, h } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HttpClient } from "../../client";
import { CollectionPage, defineCollection, readListPage, useCollection } from "../../collection";
import { encodeState } from "../../collection/state";
import { identityRoutes } from "../../modules/identity/routes";
import type { UserRow } from "../../modules/identity/entities";
import { usePlatform } from "../../platform";
import { settle } from "../../testing";
import { callsTo, dataOf, listOf, startScreen, stopApplications } from "../testing";
import { USER_VIEWS } from "./list";
import { usersRoutes } from "./routes";

vi.setConfig({ testTimeout: 30_000 });
afterEach(stopApplications);

const nav = [{ i18n: "nav.people", route: "people", permissions: ["iam.user:view"] }];
const messages = { en: { nav: { people: "People" } } };

const Extra = { props: ["subject", "name"], render() { return h("p", { "data-extra": "" }, `${(this as unknown as { name: string }).name} #${(this as unknown as { subject: { id: number } }).subject.id}`); } };

describe("usersFeature", () => {
  it("adds the application's own sections to a person's record, after its own, with what it makes of the person", async () => {
    const { target } = await startScreen({
      permissions: ["iam.user:view"],
      location: "/users/2/roles",
      answers: {
        "GET /v1/iam/users/2": dataOf({ id: 2, login: "ivan", name: "Ivan", email: "i@x.test", phone: "", locale: "en", active: true, status: "active", last_sign_in: null, locked_until: null, created_at: "2026-09-01T08:00:00Z" }),
        "GET /v1/iam/users/2/sessions": dataOf({ sessions: [] }),
      },
      users: { sections: [{ path: "roles", component: Extra, props: (p) => ({ subject: { kind: "user", id: p.id }, name: p.name }), meta: { access: "iam.user:view", section: { labelKey: "core.users.sections.general", icon: "user3Line" } } }] },
    });
    expect(target.querySelector("[data-extra]")?.textContent).toBe("Ivan #2");
  });

  describe("PersonSection.after", () => {
    const who = dataOf({ id: 2, login: "ivan", name: "Ivan", email: "i@x.test", phone: "", locale: "en", active: true, status: "active", last_sign_in: null, locked_until: null, created_at: "2026-09-01T08:00:00Z" });
    const section = (path: string, label: string, after?: "signin" | "general") => ({ path, ...(after && { after }), component: Extra, meta: { section: { labelKey: label, icon: "user3Line" as const, groupKey: "own.group" } } });
    const open = (sections: ReturnType<typeof section>[]) =>
      startScreen({
        permissions: ["iam.user:view"],
        location: "/users/2/general",
        answers: { "GET /v1/iam/users/2": who, "GET /v1/iam/users/2/sessions": dataOf({ sessions: [] }) },
        messages: { en: { own: { group: "Own", roles: "Roles", teams: "Teams", end: "At the end" } } },
        users: { sections },
      });
    // The navigator's links and group headings, in order: the order of the sections and where a group starts.
    const listed = (target: HTMLElement) => [...target.querySelectorAll("nav[aria-label='Parts of the person'] a, [data-test='section-group']")].map((node) => node.textContent?.trim());

    it("puts the section right after the one it names, in that one's group, and the rest at the end", async () => {
      const { target } = await open([section("end", "own.end"), section("roles", "own.roles", "signin"), section("teams", "own.teams", "signin")]);
      // Roles and Teams sit under Access with Sign-in and Sessions, not under a group of their own; the section without `after` ends the list.
      expect(listed(target)).toEqual(["Person", "Basic details", "Access", "Sign-in", "Roles", "Teams", "Sessions0", "Activity", "Sign-in history", "Changes", "Own", "At the end"]);
    });

    it("is a start-up error naming the valid sections when it names a section that is not built in", async () => {
      const { usersFeature } = await import("./feature");
      expect(() => usersFeature({ sections: [{ ...section("roles", "own.roles"), after: "nowhere" as "signin" }] })).toThrow(/"roles".*"nowhere".*general, signin, sessions, signins, changes, activity/);
    });

    it("lists exactly the sections the record has", async () => {
      const { PERSON_SECTIONS } = await import("./personSections");
      const { usersRoutes } = await import("./routes");
      const record = usersRoutes.records.find((entry) => entry.name === "users.record")!;
      expect(PERSON_SECTIONS).toEqual((record.children ?? []).map((child) => child.path));
    });
  });

  it("installs the people and the profile, and the people can be left out", async () => {
    const both = await startScreen({ permissions: ["iam.user:view"], location: "/", answers: {} });
    expect(both.application.router.hasRoute("users.index")).toBe(true);
    expect(both.application.router.hasRoute("users.record")).toBe(true);
    expect(both.application.router.hasRoute("profile")).toBe(true);
    stopApplications();

    const mineOnly = await startScreen({ permissions: ["iam.user:view"], location: "/", answers: {}, users: { people: false } });
    expect(mineOnly.application.router.hasRoute("users.index")).toBe(false);
    expect(mineOnly.application.router.hasRoute("users.record")).toBe(false);
    expect(mineOnly.application.router.hasRoute("profile")).toBe(true);
  });

  it("opens the users list from the destination the backend's menu names", async () => {
    await startScreen({ permissions: ["iam.user:view"], location: "/", answers: {}, navigation: nav, messages, users: { destination: "people" } });
    expect(screen.getAllByRole("link", { name: "People" })[0]!.getAttribute("href")).toBe("/users");
  });

  it("keeps the destination of a record page highlighted on the list", async () => {
    await startScreen({
      permissions: ["iam.user:view"],
      location: "/users/2/general",
      answers: {
        "GET /v1/iam/users/2": dataOf({ id: 2, login: "ivan", name: "Ivan", email: "i@x.test", phone: "", locale: "en", active: true, status: "active", last_sign_in: null, locked_until: null, created_at: "2026-09-01T08:00:00Z" }),
        "GET /v1/iam/users/2/sessions": dataOf({ sessions: [] }),
        "GET /v1/iam/users": listOf([]),
      },
      navigation: nav,
      messages,
      users: { destination: "people" },
    });
    expect(screen.getAllByRole("link", { name: "People" }).some((link) => link.getAttribute("aria-current") !== null)).toBe(true);
  });

  it("asks for identityFeature when Sign in as is on, and not when it is off", async () => {
    const { createApplication, defineFeature } = await import("../../app");
    const { createPlatform, parseBootstrap } = await import("../../platform");
    const { usersFeature } = await import("./feature");
    const platform = createPlatform({ config: parseBootstrap({ locale: "en", app_name: "T", api_base: "/api" }), session: { load: async () => null, signOut: async () => undefined } });
    const make = (users: Parameters<typeof usersFeature>[0]) => () => createApplication({ platform, features: [usersFeature(users), defineFeature({ id: "home", routes: [{ name: "home", path: "/", component: { render: () => null } }, { name: "login", path: "/login", component: { render: () => null }, meta: { public: true } }] })] });
    expect(make({})).toThrow(/identity/);
    expect(make({ signInAs: false })).not.toThrow();
  });
});

describe("usersFeature({ collection })", () => {
  const person = (id: number, name: string) => ({ id, login: name.toLowerCase(), name, email: `${name.toLowerCase()}@x.test`, phone: "", locale: "en", active: true, status: "active", last_sign_in: null, locked_until: null, created_at: "2026-09-01T08:00:00Z" });
  const rows = [person(1, "Ana"), person(2, "Ivan"), person(3, "Kata")];

  // The application's list: the library's id and state, plus a dealer filter that go-core's Searcher takes.
  let http: HttpClient;
  const dealerList = defineCollection({
    id: "identity.users",
    stateVersion: 1,
    load: async (query, { signal }) => readListPage<UserRow>(await http.request(identityRoutes.usersList, { view: query.view ?? undefined, page: query.page, per_page: query.pageSize, dealer_id: query.filters.dealer_id }, { signal }), query),
    key: (user: UserRow) => user.id,
    query: { sorts: ["name"], filters: ["dealer_id"], views: USER_VIEWS },
    defaults: { sort: "name", direction: "asc", view: "active" },
  });
  const DealerPeople = defineComponent({
    setup() {
      http = usePlatform().http;
      const people = useCollection(dealerList, { columns: [{ key: "name", label: "Person", kind: "identity", subtitle: (user: UserRow) => user.email, sort: "name" }], state: { kind: "url", key: "query" }, recordRoute: (user) => usersRoutes.record({ id: user.id }) });
      return () => h(CollectionPage, { collection: people as never, title: "Dealer people" });
    },
  });

  const answers = { "GET /v1/iam/users": () => listOf(rows), "GET /v1/iam/users/2": dataOf(rows[1]), "GET /v1/iam/users/2/sessions": dataOf({ sessions: [] }) };

  it("walks the record's previous / next through the application's list, with the filters only it knows", async () => {
    const from = encodeState(dealerList, { ...dealerList.defaults, filters: { dealer_id: "7" } });
    const { calls, application } = await startScreen({ permissions: ["iam.user:view"], location: `/users?query=${from}`, answers, users: { collection: dealerList, replace: { list: DealerPeople } } });
    await fireEvent.click(await screen.findByRole("link", { name: "Ivan" }));
    await settle();

    expect(application.router.currentRoute.value.name).toBe("users.record.general");
    expect(await screen.findByRole("link", { name: "Next record" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Previous record" })).toBeTruthy();
    const asked = callsTo(calls, "GET", "/v1/iam/users");
    expect(asked.length).toBeGreaterThan(1); // the list, then the record's neighbours
    for (const call of asked) expect(new URL(call.url, "http://test.invalid").searchParams.get("dealer_id")).toBe("7");
  });

  it("walks it through the library's own list when the application passes none", async () => {
    const { application } = await startScreen({ permissions: ["iam.user:view"], location: "/users", answers });
    await fireEvent.click(await screen.findByRole("link", { name: "Ivan" }));
    await settle();

    expect(application.router.currentRoute.value.name).toBe("users.record.general");
    expect(await screen.findByRole("link", { name: "Next record" })).toBeTruthy();
  });
});
