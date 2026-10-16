import { isApiError, type HttpClient } from "../client";
import { parseSessionPayload, type PlatformOptions, type SessionAdapter, type SessionUser, type UserParser } from "../platform";
import type { BootstrapConfig } from "../platform";
import { identityRoutes } from "../modules/identity/routes";
import { embedHeaders, embeddedSessionAdapter, type EmbedSession } from "./embed";
import { parseIdentityUser, type IdentityUser } from "./user";

const unauthorized = (error: unknown): boolean => isApiError(error) && error.kind === "unauthorized";

/** Swaps the refresh token (the cookie travels by itself) for new tokens; resolves with the session payload, rejects with `unauthorized` when there is nothing to swap. */
const refreshTokens = (http: HttpClient, signal?: AbortSignal) =>
  http.request(identityRoutes.refresh, { refresh_token: "" }, { signal, handleUnauthorized: false });

/**
 * The session over go-core's identity routes: `GET /v1/auth/me`; when that says 401 (the access token ran
 * out while the app was closed) one refresh with the refresh cookie before giving up; sign-out ends it.
 */
export function identitySessionAdapter<U extends SessionUser>(http: HttpClient, parseUser: UserParser<U>): SessionAdapter<U> {
  return {
    async load(signal) {
      try {
        const { data } = await http.request(identityRoutes.me, undefined, { signal, handleUnauthorized: false });
        return parseSessionPayload(data, parseUser);
      } catch (error) {
        if (!unauthorized(error)) throw error;
      }
      try {
        const { data } = await refreshTokens(http, signal);
        return parseSessionPayload(data, parseUser);
      } catch (error) {
        if (unauthorized(error)) return null; // nobody is signed in
        throw error;
      }
    },
    async signOut() {
      try {
        await http.request(identityRoutes.logout, undefined, { handleUnauthorized: false });
      } catch (error) {
        if (!unauthorized(error)) throw error; // already signed out
      }
    },
  };
}

/** What `createPlatform` is given to run on go-core's identity module. */
export type IdentityPlatformOptions<U extends SessionUser> = Required<Pick<PlatformOptions<U, BootstrapConfig>, "session" | "renewSession">> & Pick<PlatformOptions<U, BootstrapConfig>, "renewable" | "headers" | "onSessionExpired">;

/** What `identityPlatform` takes. */
export interface IdentityPlatformInput<U extends SessionUser> {
  /** The application's own user projection; see `identityPlatform`. */
  parseUser?: UserParser<U>;
  /** False while the session has no refresh token (an embed bearer session): nothing renews it, a 401 ends it. See `PlatformOptions.renewable`. */
  renewable?: () => boolean;
  /**
   * A session handed over as a bearer token (an iframe whose cookies are blocked): while one is held the requests carry it,
   * the session is read with it and cannot be renewed, a refused or run-out token is forgotten, and signing out forgets
   * it. It sets `headers` and `onSessionExpired` of the platform, so spread `identityPlatform()` first and, when you set
   * either yourself, keep the embed's part (`embed.end()` on expiry, `embedHeaders(embed)`).
   */
  embed?: EmbedSession;
}

/**
 * The platform options that wire the session to go-core's identity routes: reading it (`/auth/me`, with one
 * refresh when the access token ran out), ending it, and renewing it when a request is answered 401.
 *
 *   const platform = createPlatform({ config, ...identityPlatform() });
 *
 * The user is go-core's default projection (`IdentityUser`); an application that projects its own passes
 * `parseUser`, which must keep the `id` and the `login` (the prompt for an expired session shows it).
 */
export function identityPlatform(options?: Omit<IdentityPlatformInput<IdentityUser>, "parseUser">): IdentityPlatformOptions<IdentityUser>;
export function identityPlatform<U extends SessionUser & { readonly login: string }>(options: IdentityPlatformInput<U> & { parseUser: UserParser<U> }): IdentityPlatformOptions<U>;
export function identityPlatform(options?: IdentityPlatformInput<SessionUser>): IdentityPlatformOptions<IdentityUser> | IdentityPlatformOptions<SessionUser> {
  const parseUser = options?.parseUser ?? parseIdentityUser;
  const embed = options?.embed;
  const wiring: IdentityPlatformOptions<SessionUser> = {
    session: (http) => {
      const cookies = identitySessionAdapter(http, parseUser);
      return embed ? embeddedSessionAdapter(cookies, http, parseUser, embed) : cookies;
    },
    ...((embed || options?.renewable) && { renewable: () => !embed?.active() && (options?.renewable?.() ?? true) }),
    ...(embed && { headers: embedHeaders(embed), onSessionExpired: embed.end }),
    async renewSession(session, http) {
      try {
        await refreshTokens(http);
        return (await session.refresh()).status === "authenticated";
      } catch {
        return false; // the refresh token is gone or refused: the session ends
      }
    },
  };
  return wiring;
}
