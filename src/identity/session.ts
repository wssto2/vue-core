import { isApiError, type HttpClient } from "../client";
import { parseSessionPayload, type PlatformOptions, type SessionAdapter, type SessionUser, type UserParser } from "../platform";
import type { BootstrapConfig } from "../platform";
import { identityRoutes } from "../modules/identity/routes";
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
export type IdentityPlatformOptions<U extends SessionUser> = Required<Pick<PlatformOptions<U, BootstrapConfig>, "session" | "renewSession">>;

/**
 * The platform options that wire the session to go-core's identity routes: reading it (`/auth/me`, with one
 * refresh when the access token ran out), ending it, and renewing it when a request is answered 401.
 *
 *   const platform = createPlatform({ config, ...identityPlatform() });
 *
 * The user is go-core's default projection (`IdentityUser`); an application that projects its own passes
 * `parseUser`, which must keep an `id`.
 */
export function identityPlatform(): IdentityPlatformOptions<IdentityUser>;
export function identityPlatform<U extends SessionUser>(options: { parseUser: UserParser<U> }): IdentityPlatformOptions<U>;
export function identityPlatform(options?: { parseUser: UserParser<SessionUser> }): IdentityPlatformOptions<IdentityUser> | IdentityPlatformOptions<SessionUser> {
  const parseUser = options?.parseUser ?? parseIdentityUser;
  const wiring: IdentityPlatformOptions<SessionUser> = {
    session: (http) => identitySessionAdapter(http, parseUser),
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

/** Renews the tokens, for `keepSessionAlive({ renew })`: the session is read again afterwards. */
export const renewIdentityTokens = async (platform: { readonly http: HttpClient }): Promise<void> => {
  await refreshTokens(platform.http);
};
