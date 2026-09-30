// Fixtures for this folder's tests; the declaration build excludes it.
import type { AccessClause, AccessSnapshot, HeldAccess } from "./access";
import type { SessionSnapshot } from "./session";

export const held = (level: string, id: number | undefined, qualifier: HeldAccess["qualifier"] = "all", clauses?: AccessClause[]): HeldAccess => {
  const scope = id === undefined ? { level } : { level, id };
  return { scope, qualifier, clauses: clauses ?? [{ scope, qualifier }] };
};

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

export const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
