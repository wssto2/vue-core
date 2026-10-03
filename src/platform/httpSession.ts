import { ApiError, isApiError, type HttpClient } from "../client";
import { parseAccessSnapshot } from "./access";
import { parseNavigation } from "./navigation";
import type { SessionAdapter, SessionImpersonator, SessionSnapshot, SessionUser } from "./session";

export interface HttpSessionOptions {
  /** Where the session is read (GET). Default `/auth/me`. */
  mePath?: string;
  /** Where it is ended (POST). Default `/auth/logout`. */
  signOutPath?: string;
}

export type UserParser<U extends SessionUser> = (raw: unknown) => U;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The default projection: the user's id, nothing else. Applications that need a name or roles pass their own parser. */
export const parseSessionUser: UserParser<SessionUser> = (raw) => {
  if (isObject(raw) && (typeof raw.id === "number" || typeof raw.id === "string")) return { id: raw.id };
  throw new TypeError("expected an object with a numeric or string id");
};

/**
 * Reads go-core's session payload `{ user, expires_at?, access, navigation? }` (the answer of `/auth/me`, and of a login).
 * Throws an `ApiError` of kind `malformed` naming what is wrong.
 */
export function parseSessionPayload<U extends SessionUser = SessionUser>(
  raw: unknown,
  parseUser: UserParser<U> = parseSessionUser as UserParser<U>,
): SessionSnapshot<U> {
  const issues: string[] = [];
  if (!isObject(raw)) throw malformed(["expected an object"]);

  let user: U | null = null;
  try {
    user = parseUser(raw.user);
  } catch (error) {
    issues.push(`user: ${error instanceof Error ? error.message : "invalid"}`);
  }

  let expiresAt: Date | null = null;
  if (raw.expires_at !== undefined && raw.expires_at !== null) {
    const date = typeof raw.expires_at === "string" ? new Date(raw.expires_at) : null;
    // ARV compared `new Date(garbage) <= new Date()`, which is false: a bad value meant "never expires".
    if (date === null || Number.isNaN(date.getTime())) issues.push("expires_at: expected an ISO date-time string");
    else expiresAt = date;
  }

  let impersonator: SessionImpersonator | undefined;
  if (raw.impersonator !== undefined && raw.impersonator !== null) {
    const who = raw.impersonator;
    if (isObject(who) && (typeof who.id === "number" || typeof who.id === "string") && typeof who.name === "string") impersonator = { id: who.id, name: who.name };
    else issues.push("impersonator: expected { id, name }");
  }

  const access = parseAccessSnapshot(raw.access);
  issues.push(...access.issues);
  const navigation = raw.navigation === undefined || raw.navigation === null ? undefined : parseNavigation(raw.navigation, issues);
  if (user === null || issues.length > 0) throw malformed(issues);
  return { user, expiresAt, access: access.snapshot, ...(impersonator && { impersonator }), ...(navigation && { navigation }) };
}

const malformed = (issues: readonly string[]) =>
  new ApiError({ kind: "malformed", message: `Unreadable session payload: ${issues.join("; ")}` });

/** A session adapter over the HTTP client and go-core's generic auth endpoints; paths are configurable. */
export function httpSessionAdapter(http: HttpClient, options?: HttpSessionOptions): SessionAdapter;
export function httpSessionAdapter<U extends SessionUser>(
  http: HttpClient,
  options: HttpSessionOptions & { parseUser: UserParser<U> },
): SessionAdapter<U>;
export function httpSessionAdapter(
  http: HttpClient,
  options: HttpSessionOptions & { parseUser?: UserParser<SessionUser> } = {},
): SessionAdapter {
  const { mePath = "/auth/me", signOutPath = "/auth/logout", parseUser } = options;
  return {
    async load(signal) {
      try {
        // A 401 here is the answer "nobody is signed in", not an expiry.
        const { data } = await http.get(mePath, { signal, handleUnauthorized: false });
        return parseSessionPayload(data, parseUser);
      } catch (error) {
        if (isApiError(error) && error.kind === "unauthorized") return null;
        throw error;
      }
    },
    async signOut() {
      try {
        await http.post(signOutPath, undefined, { handleUnauthorized: false });
      } catch (error) {
        if (!(isApiError(error) && error.kind === "unauthorized")) throw error; // already signed out
      }
    },
  };
}
