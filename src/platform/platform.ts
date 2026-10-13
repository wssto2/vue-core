import type { App, InjectionKey } from "vue";
import { createHttpClient, type HttpClient, type HttpClientOptions, type Transport } from "../client";
import { createAccessClient, type AccessClient, type AccessClientOptions } from "./access";
import type { BootstrapConfig } from "./bootstrap";
import type { RegisteredConfig, RegisteredUser } from "./index";
import { defineFeatureContext } from "./context";
import { httpSessionAdapter } from "./httpSession";
import { createSession, heldSession, type BeforeSignOutHook, type Session, type SessionAdapter, type SessionUser } from "./session";

/**
 * One application's shared services. Everything in it belongs to this instance alone. Bare `Platform` is the
 * application's own: its user and config as declared in `PlatformRegistry`.
 */
export interface Platform<U extends SessionUser = RegisteredUser, C extends BootstrapConfig = RegisteredConfig> {
  readonly config: C;
  readonly http: HttpClient;
  readonly session: Session<U>;
  /** Reads the session's access; empty until the session is restored or established. */
  readonly access: AccessClient;
}

export interface PlatformOptions<U extends SessionUser, C extends BootstrapConfig> extends AccessClientOptions {
  /** The validated bootstrap config (`readBootstrap()`); its `apiBase` prefixes every request. */
  config: C;
  /** Default: `fetch`. */
  transport?: Transport;
  /** Extra headers on every request (an embed token, a tenant header); read again per attempt. */
  headers?: HttpClientOptions["headers"];
  credentials?: HttpClientOptions["credentials"];
  requestId?: HttpClientOptions["requestId"];
  /**
   * How the session is read and ended: an adapter, or a function building one over this platform's
   * client. Default: `httpSessionAdapter` (GET `/auth/me`, POST `/auth/logout`, user = `{ id }`).
   */
  session?: SessionAdapter<U> | ((http: HttpClient) => SessionAdapter<U>);
  /**
   * How the session is renewed (`session.renew()`): when a request is answered 401 while signed in, before the
   * session is given up, and when `keepSessionAlive` finds it due. Concurrent renewals, whoever asked, share one call. Renew it with the platform's client (for example a refresh-token call, then
   * `session.refresh()`) and return true: the failed request is sent again. False or a throw expires
   * the session. Without it a 401 expires the session at once.
   */
  renewSession?: (session: Session<U>, http: HttpClient) => Promise<boolean>;
  /**
   * False while the session cannot be renewed, for example an embed session (a bearer token with no refresh token):
   * a 401 then ends the session at once and `keepSessionAlive` stays idle. Asked each time. Default: renewable when `renewSession` is given.
   */
  renewable?: () => boolean;
  /** Called after a 401 expired a signed-in session: the application decides (usually: go to the login page). */
  onSessionExpired?: () => void;
  /** Called with the failure of a session load or of a before-sign-out hook. */
  onSessionError?: (error: unknown) => void;
  /**
   * Runs at every sign-out while the session still exists: before the server is told and before the local state
   * clears (ARV removes the device's push subscription here). Bounded to 3 s; a failure is reported to
   * `onSessionError` and never blocks the sign-out. A feature adds its own with `session.onBeforeSignOut`.
   */
  beforeSignOut?: BeforeSignOutHook<U>;
}

/**
 * Builds the app-scoped services: HTTP client, session, access and the config. Nothing runs at
 * construction (no request, timer or listener); the session is asked when the application calls
 * `platform.session.restore()`. Every call returns an independent set.
 */
export function createPlatform<C extends BootstrapConfig>(options: PlatformOptions<SessionUser, C> & { session?: undefined }): Platform<SessionUser, C>;
export function createPlatform<U extends SessionUser, C extends BootstrapConfig>(
  options: PlatformOptions<U, C> & { session: NonNullable<PlatformOptions<U, C>["session"]> },
): Platform<U, C>;
export function createPlatform<U extends SessionUser, C extends BootstrapConfig>(options: PlatformOptions<U, C>): Platform<U, C> {
  const http = createHttpClient({
    baseUrl: options.config.apiBase,
    transport: options.transport,
    headers: options.headers,
    credentials: options.credentials,
    requestId: options.requestId,
    async onUnauthorized() {
      return (await session.renew()) ? "retry" : "fail"; // one renewal for every caller; a refused one has ended the session
    },
  });

  // Without `session` the overloads fix U to SessionUser, which is what the default adapter produces.
  const source = options.session ?? ((client: HttpClient) => httpSessionAdapter(client) as unknown as SessionAdapter<U>);
  const adapter = typeof source === "function" ? source(http) : source;
  const session = createSession<U>(adapter, {
    onError: options.onSessionError,
    onExpired: options.onSessionExpired,
    beforeSignOut: options.beforeSignOut,
    renew: options.renewSession && ((current) => options.renewSession!(current, http)),
    renewable: options.renewable,
  });
  const access = createAccessClient(
    () => {
      return heldSession(session.state.value)?.access ?? null; // a session that just expired still shows what it showed
    },
    { covers: options.covers },
  );

  return { config: options.config, http, session, access };
}

/** The platform as a context: `installPlatform(app, platform)` once, `usePlatform()` in components. */
const context = defineFeatureContext<Platform>("platform");
// Annotated so the declaration build keeps `Platform` (the registered one) instead of expanding it to the defaults.
export const platformKey: InjectionKey<Platform> = context[0];
export const usePlatform: () => Platform = context[1];

export function installPlatform(app: App, platform: Platform): void {
  app.provide(platformKey, platform);
}
