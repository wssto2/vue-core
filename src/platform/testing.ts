// Fixtures for this folder's tests; the declaration build excludes it.
import type { AccessSnapshot, HeldAccess } from "./access";
import type { SessionSnapshot } from "./session";

export { heldAccess as held } from "../testing/platform";

export const accessOf = (permissions: Record<string, HeldAccess>, extra: Partial<AccessSnapshot> = {}): AccessSnapshot => ({
  root: false,
  permissions,
  unavailable: [],
  ...extra,
});

export const snapshotOf = (id: number, permissions: Record<string, HeldAccess> = {}, expiresAt: Date | null = null): SessionSnapshot => ({
  user: { id },
  expiresAt,
  access: accessOf(permissions),
});

/** The wire payload of /auth/me for a user, for adapter tests. */
export const mePayload = (id: number, permissions: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  user: { id, name: "Someone" },
  expires_at: "2030-01-01T00:00:00Z",
  navigation: [],
  access: { subject: { kind: "user", id }, root: false, permissions, ...extra },
});

export { deferred } from "../testing/async";
