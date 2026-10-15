import { screen } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApplication, defineFeature } from "../../app";
import { createPlatform, parseBootstrap } from "../../platform";
import { dataOf, startScreen, stopApplications } from "../testing";
import { serviceAccountsFeature } from "./feature";
import { ACCOUNT_VIEW, account, startAccounts } from "./testing";

vi.setConfig({ testTimeout: 30_000 });
afterEach(stopApplications);

const nav = [{ i18n: "nav.accounts", route: "serviceaccounts", permissions: [ACCOUNT_VIEW] }];
const messages = { en: { nav: { accounts: "Systems" } } };

describe("serviceAccountsFeature", () => {
  it("installs the list and the record", async () => {
    const { application } = await startAccounts({ permissions: [ACCOUNT_VIEW], location: "/", answers: {} });
    expect(application.router.hasRoute("serviceaccounts.index")).toBe(true);
    expect(application.router.hasRoute("serviceaccounts.record")).toBe(true);
    expect(application.router.resolve({ name: "serviceaccounts.record", params: { id: 21 } }).path).toBe("/iam/service-accounts/21");
  });

  it("links the destination to the list and keeps it highlighted on an account's record", async () => {
    const { accessFeature } = await import("../../access");
    await startScreen({
      permissions: [ACCOUNT_VIEW],
      location: "/iam/service-accounts/21",
      answers: { "GET /v1/iam/service-accounts/21": dataOf(account()), "GET /v1/iam/service-accounts/21/keys": dataOf({ keys: [] }) },
      navigation: nav,
      messages,
      features: [accessFeature({ catalogue: {} }), serviceAccountsFeature({ destination: "serviceaccounts" })],
    });
    const links = screen.getAllByRole("link", { name: "Systems" });
    expect(links[0]!.getAttribute("href")).toBe("/iam/service-accounts");
    expect(links.some((link) => link.getAttribute("aria-current") !== null)).toBe(true);
  });

  it("asks for the access feature: the roles of an account are its screens'", () => {
    const platform = createPlatform({ config: parseBootstrap({ locale: "en", app_name: "T", api_base: "/api" }), session: { load: async () => null, signOut: async () => undefined } });
    const home = defineFeature({ id: "home", routes: [{ name: "home", path: "/", component: { render: () => null } }, { name: "login", path: "/login", component: { render: () => null }, meta: { public: true } }] });
    expect(() => createApplication({ platform, features: [serviceAccountsFeature(), home] })).toThrow(/access/);
  });
});
