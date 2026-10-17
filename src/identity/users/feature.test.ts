import { screen } from "@testing-library/vue";
import { h } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dataOf, listOf, startScreen, stopApplications } from "../testing";

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
