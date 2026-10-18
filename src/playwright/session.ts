import type { Page } from "@playwright/test";
import type { AccessQualifier } from "../platform";
import type { MyAccess, Node, PermissionAccess, Scope, SessionResponse, User } from "../modules/identity/entities";
import { json, ok } from "./envelope";

const FUTURE_EXPIRY = "2099-01-01T00:00:00.000Z";

/** The signed-in person a spec starts with: only what go-core's identity returns. An app adds its own fields through `mockAuth`'s `user`. */
export const defaultUser: User = { id: 1, login: "admin", name: "Test Admin", email: "admin@test.com", locale: "en" };

export type MockAuthOptions = {
  /** The signed-in user's navigation (default none). */
  navigation?: Node[];
  /** Fields merged over `defaultUser`: a different person, or the fields your application adds to the user. */
  user?: Partial<User> & Record<string, unknown>;
  /** The qualifier each permission is held at (default `all`), e.g. `{ "crm.lead:view": "own_location" }`. */
  access?: Record<string, AccessQualifier>;
  /** Where every permission is held (default the organization, which is the root: no id). */
  scope?: HeldAt;
};

/** Where a permission is held: the organization, or a place of a level (`{ level: "dealer", id: 1 }`). */
export type HeldAt = { level: string; id?: number };

// The wire says qualifiers as strings ("own" | "own_location" | "all"); go-core's generated type says number.
type WireAccess = Omit<MyAccess, "permissions"> & { permissions: Record<string, Omit<PermissionAccess, "qualifier"> & { qualifier: AccessQualifier }> };

/** Fields of the session payload to set or replace (an `impersonator`, another `expires_at`), and any the application adds. */
export type SessionExtra = Partial<Omit<SessionResponse, "access">> & { access?: WireAccess } & Record<string, unknown>;

/** The `/auth/me` `access` payload for the given permissions, every one at `scope` with its qualifier. The organization has no id: it is go-core's root scope, and `root` says a binding is there. */
export function accessOf(policies: string[], qualifiers: Record<string, AccessQualifier> = {}, scope: HeldAt = { level: "organization" }): WireAccess {
  const held: Scope = scope.id === undefined ? { level: scope.level } : { level: scope.level, id: scope.id };

  return {
    subject: { kind: "user", id: 1 },
    root: scope.level === "organization",
    permissions: Object.fromEntries(policies.map((p) => [p, { scope: held, qualifier: qualifiers[p] ?? "all", clauses: [] }])),
  };
}

/** The session payload of go-core's identity (`/auth/me`, `/auth/refresh`, `/auth/login-as`), without its envelope. */
export function authResponse(policies: string[] = [], extra: SessionExtra = {}) {
  return { user: defaultUser, expires_at: FUTURE_EXPIRY, navigation: [], access: accessOf(policies), ...extra };
}

/** The same, as the server sends it: inside go-core's `{ success, data }` envelope. */
export const authBody = (policies: string[] = [], extra: SessionExtra = {}) => ok(authResponse(policies, extra));

/** Signs the page in: answers go-core identity's `GET /api/v1/auth/me` with a session that holds `policies`. */
export async function mockAuth(page: Page, policies: string[] = [], options: MockAuthOptions = {}): Promise<void> {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill(json(authBody(policies, { user: { ...defaultUser, ...options.user }, navigation: options.navigation ?? [], access: accessOf(policies, options.access, options.scope) }))),
  );
}
