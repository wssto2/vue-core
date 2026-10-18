import type { Page } from "@playwright/test";
import { bindingOf, mockAuth as mockSession, role, scopeOf, serveAccess, serveNotifications, type MockAuthOptions } from "@wssto2/vue-core/playwright";

// e2e/support.ts: the application's own wrapper over the library's mocks. The library knows go-core's wire and a neutral
// user; the application adds its user's fields, its roles and its places, so no spec repeats them.
export const appUser = { account_type_id: 1, dealer_id: 1, locale: "hr" };

const dealer = scopeOf("dealer", 1, "Acme Zagreb");
export const SELLER = role("seller", { name: "Seller", grants: [{ permission: "crm.lead:view", qualifier: "own" }] });
export const MANAGER = role("manager", { name: "Manager", grants: [{ permission: "crm.lead:view", qualifier: "all" }] });

/** Signs in a person of this application who holds `policies` at dealer 1. */
export const mockAuth = (page: Page, policies: string[] = [], options: MockAuthOptions = {}) =>
  mockSession(page, policies, { scope: { level: "dealer", id: 1 }, ...options, user: { ...appUser, ...options.user } });

/** The roles page: the application's roles and places, one person already holding the seller role. */
export const serveRoles = (page: Page) =>
  serveAccess(page, {
    roles: [SELLER, MANAGER],
    places: { root_level: "organization", root: true, places: [{ level: "dealer", id: 1, name: dealer.name!, parent_level: "organization", parent_id: null }] },
    bindings: { "user:3": [bindingOf(1, SELLER, dealer)] },
  });

/** The bell: sign in, then the library's notification routes on the application's time zone. */
export const serveBell = async (page: Page, policies: string[] = []) => {
  await mockAuth(page, policies);
  return serveNotifications(page, { timeZone: "Europe/Zagreb" });
};
