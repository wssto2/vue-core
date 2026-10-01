import { createPlatform, type AccessClause, type AccessQualifier, type AccessSnapshot, type BootstrapConfig, type HeldAccess, type NavigationNode, type Platform, type PlatformOptions, type SessionAdapter, type SessionSnapshot, type SessionUser } from "../platform";
import type { Transport } from "../client";

/**
 * How a permission is held: at a level of your scope hierarchy (`organization`, `dealer`, ...) with an
 * optional id, for `all` records, only the user's `own` or those of their `own_location`. For the
 * `permissions` record of `createTestSession`; a plain permission name there means "everything, at the organization".
 */
export function heldAccess(level: string, id?: number, qualifier: AccessQualifier = "all", clauses?: readonly AccessClause[]): HeldAccess {
  const scope = id === undefined ? { level } : { level, id };
  return { scope, qualifier, clauses: clauses ?? [{ scope, qualifier }] };
}

export interface TestSessionOptions<U extends SessionUser = SessionUser> {
  /** Default `{ id: 1 }`. */
  user?: U;
  /** Permissions held at the organization for every record (names), or exactly how each is held (`heldAccess`). */
  permissions?: readonly string[] | Readonly<Record<string, HeldAccess>>;
  /** Granted by a role but switched off for the tenant: not held. */
  unavailable?: readonly string[];
  /** Some binding is at the root scope. */
  root?: boolean;
  navigation?: readonly NavigationNode[];
  expiresAt?: Date | null;
}

/** What `/auth/me` would say for a user: for `session.establish(...)` mid-test, or an adapter that answers it. */
export function createTestSession<U extends SessionUser = SessionUser>(options: TestSessionOptions<U> = {}): SessionSnapshot<U> {
  const { permissions = [] } = options;
  const held: Record<string, HeldAccess> = Array.isArray(permissions)
    ? Object.fromEntries(permissions.map((name: string) => [name, heldAccess("organization")]))
    : { ...(permissions as Record<string, HeldAccess>) };
  const access: AccessSnapshot = { root: options.root ?? false, permissions: held, unavailable: options.unavailable ?? [] };
  return {
    user: options.user ?? ({ id: 1 } as U),
    expiresAt: options.expiresAt ?? null,
    access,
    ...(options.navigation ? { navigation: options.navigation } : {}),
  };
}

export interface TestPlatformOptions<U extends SessionUser = SessionUser> extends Omit<TestSessionOptions<U>, "user">, Omit<PlatformOptions<U, BootstrapConfig>, "config" | "transport" | "session"> {
  /** `null`: nobody is signed in (the session answers "none" when asked). Default: the user of `createTestSession`. */
  user?: U | null;
  /** Answers the requests the code under test makes: `scriptedTransport` or `routedTransport`. Default: any request fails the test. */
  transport?: Transport;
  /** Fields of the bootstrap config over the test's (`apiBase: ""`, `locale: "en"`, `appName: "Test app"`). */
  config?: Partial<BootstrapConfig>;
  /** A session adapter of your own; then `user`, `permissions` and the like are not used and the session starts unasked. */
  session?: SessionAdapter<U>;
}

const noRequests: Transport = async (url, init) => {
  throw new Error(`createTestPlatform: an unexpected request ${(init.method ?? "GET").toUpperCase()} ${url}. Pass a \`transport\` that answers it (scriptedTransport or routedTransport).`);
};

/**
 * A platform for a test: an HTTP client over a fake transport, a session that is already signed in
 * (no request) and the access it grants. Independent of every other platform, as production's.
 *
 *   const platform = createTestPlatform({ user: { id: 7 }, permissions: ["tickets:view"], transport });
 *   platform.access.can("tickets:view"); // true, at once
 */
export function createTestPlatform<U extends SessionUser = SessionUser>(options: TestPlatformOptions<U> = {}): Platform<U> {
  const { user, permissions, unavailable, root, navigation, expiresAt, transport, config, session, ...rest } = options;
  const snapshot = user === null ? null : createTestSession<U>({ user, permissions, unavailable, root, navigation, expiresAt });
  const adapter: SessionAdapter<U> = session ?? { load: async () => snapshot, signOut: async () => undefined };
  const platform = createPlatform<U, BootstrapConfig>({
    ...rest,
    config: { apiBase: "", locale: "en", appName: "Test app", capabilities: [], ...config },
    transport: transport ?? noRequests,
    session: adapter,
  });
  if (!session && snapshot) platform.session.establish(snapshot);
  return platform;
}
