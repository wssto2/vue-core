import type { App } from "vue";
import { createHttpClient, type HttpClient, type HttpClientOptions, type Transport } from "../client";
import { createAccessClient, type AccessClient, type AccessClientOptions } from "./access";
import type { BootstrapConfig } from "./bootstrap";
import { defineFeatureContext } from "./context";
import { httpSessionAdapter } from "./httpSession";
import { createSession, heldSession, type BeforeSignOutHook, type Session, type SessionAdapter, type SessionUser } from "./session";

/** One application's shared services. Everything in it belongs to this instance alone. */
export interface Platform<U extends SessionUser = SessionUser, C extends BootstrapConfig = BootstrapConfig> {
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
   * Called once when a request is answered 401 while signed in, before the session is given up
   * (concurrent 401s share one call). Renew it with the platform's client (for example a refresh-token call, then
   * `session.refresh()`) and return true: the failed request is sent again. False or a throw expires
   * the session. Without it a 401 expires the session at once.
   */
  renewSession?: (session: Session<U>, http: HttpClient) => Promise<boolean>;
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
  let renewal: Promise<boolean> | null = null;

  const http = createHttpClient({
    baseUrl: options.config.apiBase,
    transport: options.transport,
    headers: options.headers,
    credentials: options.credentials,
    requestId: options.requestId,
    async onUnauthorized() {
      if (session.state.value.status !== "authenticated") return "fail"; // nothing to expire
      if (options.renewSession) {
        renewal ??= options.renewSession(session, http).then(
          (renewed) => renewed,
          () => false,
        ).finally(() => {
          renewal = null;
        });
        if (await renewal) return "retry";
      }
      session.expire();
      return "fail";
    },
  });

  // Without `session` the overloads fix U to SessionUser, which is what the default adapter produces.
  const source = options.session ?? ((client: HttpClient) => httpSessionAdapter(client) as unknown as SessionAdapter<U>);
  const adapter = typeof source === "function" ? source(http) : source;
  const session = createSession<U>(adapter, { onError: options.onSessionError, onExpired: options.onSessionExpired, beforeSignOut: options.beforeSignOut });
  const access = createAccessClient(
    () => {
      return heldSession(session.state.value)?.access ?? null; // a session that just expired still shows what it showed
    },
    { covers: options.covers },
  );

  return { config: options.config, http, session, access };
}

/** The platform as a context: `installPlatform(app, platform)` once, `usePlatform()` in components. */
export const [platformKey, usePlatform] = defineFeatureContext<Platform>("platform");

export function installPlatform(app: App, platform: Platform): void {
  app.provide(platformKey, platform);
}
