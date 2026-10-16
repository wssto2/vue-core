import { isApiError, type HttpClient } from "../client";
import { identityRoutes } from "../modules/identity/routes";
import { parseSessionPayload, type SessionAdapter, type SessionUser, type UserParser } from "../platform";

/** Where an embed session keeps its token: the part of `Storage` it uses. */
export type EmbedStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface EmbedSessionOptions {
  /** Default `sessionStorage`: tab-scoped and same-origin, which a cross-origin iframe's browser (Safari's tracking prevention) still allows where cookies and `localStorage` are blocked. */
  storage?: EmbedStorage;
  /** The storage key of the token. Default `embed_access_token`. */
  tokenKey?: string;
  /** The storage key of the moment the token ends (an ISO date). Default `embed_expires_at`. */
  expiresKey?: string;
}

/**
 * A session an iframe's host page hands over as a bearer token (the cookies of an embedded page are blocked): kept in
 * the tab's storage, sent as `Authorization: Bearer`, and not renewable, as there is no refresh token. The page that
 * receives the token calls `start`; everything else is wired by `identityPlatform({ embed })`.
 */
export interface EmbedSession {
  /** Keeps the token the server handed out, and the moment it ends. */
  start(token: string, expiresAt: string): void;
  /** Forgets the token: the page goes back to the cookie session, if there is one. */
  end(): void;
  /** The token, or null when there is none (or the storage is not available). */
  token(): string | null;
  /** Whether an embed token is held; the session then cannot be renewed. */
  active(): boolean;
  /** Whether the held token has run out (a missing end counts as run out). */
  expired(): boolean;
}

const unauthorized = (error: unknown): boolean => isApiError(error) && error.kind === "unauthorized";

/** The embed session over the tab's storage; a storage that throws (blocked, private mode) reads as no session and keeps nothing. */
export function embedSession(options: EmbedSessionOptions = {}): EmbedSession {
  const tokenKey = options.tokenKey ?? "embed_access_token";
  const expiresKey = options.expiresKey ?? "embed_expires_at";
  const storage = (): EmbedStorage | null => {
    try {
      return options.storage ?? sessionStorage;
    } catch {
      return null;
    }
  };
  const read = (key: string): string | null => {
    try {
      return storage()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  };
  const session: EmbedSession = {
    start(token, expiresAt) {
      try {
        storage()?.setItem(tokenKey, token);
        storage()?.setItem(expiresKey, expiresAt);
      } catch {
        // No storage: the token is not kept, and the page cannot read a session.
      }
    },
    end() {
      try {
        storage()?.removeItem(tokenKey);
        storage()?.removeItem(expiresKey);
      } catch {
        // Nothing was kept.
      }
    },
    token: () => read(tokenKey),
    active: () => read(tokenKey) !== null,
    expired() {
      const end = read(expiresKey);
      return end === null || new Date(end) <= new Date();
    },
  };
  return session;
}

/** The headers every request carries for an embed session: the bearer token, or none. */
export const embedHeaders = (embed: EmbedSession) => (): Record<string, string> => {
  const token = embed.token();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * The session adapter while an embed token is held: read with the bearer token (`/auth/me`, no refresh), none when the
 * token ran out or is refused (and then forgotten); sign-out ends the server's session and forgets the token. Without a
 * token it is the cookie session `inner`.
 */
export function embeddedSessionAdapter<U extends SessionUser>(inner: SessionAdapter<U>, http: HttpClient, parseUser: UserParser<U>, embed: EmbedSession): SessionAdapter<U> {
  return {
    async load(signal) {
      if (!embed.active()) return inner.load(signal);
      if (embed.expired()) {
        embed.end();
        return null;
      }
      try {
        const { data } = await http.request(identityRoutes.me, undefined, { signal, handleUnauthorized: false });
        return parseSessionPayload(data, parseUser);
      } catch (error) {
        if (!unauthorized(error)) throw error;
        embed.end();
        return null;
      }
    },
    async signOut() {
      try {
        await inner.signOut();
      } finally {
        embed.end();
      }
    },
  };
}
