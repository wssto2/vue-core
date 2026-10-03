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
