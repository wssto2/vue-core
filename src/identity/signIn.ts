import { isApiError } from "../client";
import type { Platform } from "../platform";
import { identityRoutes } from "../modules/identity/routes";
import type { LoginInput } from "../modules/identity/schemas";

/** The refusal of a sign-in that tells when the lock ends, as the moment it ends; null for any other failure. */
export function lockedUntil(error: unknown): Date | null {
  if (!isApiError(error) || error.code !== "identity.signin.locked") return null;
  const value = error.params?.locked_until;
  const until = typeof value === "string" ? new Date(value) : null;
  return until && !Number.isNaN(until.getTime()) ? until : null;
}

/**
 * Signs in with a login and a password: the server sets the cookies, then the session reads who is
 * signed in (the same payload as at start-up). Rejects with the `ApiError` of a refusal
 * (`identity.signin.failed` / `locked` / `inactive`, 429 when the attempts come too fast), or with the
 * failure of reading the session afterwards.
 */
export async function signIn({ http, session }: Pick<Platform, "http" | "session">, input: LoginInput): Promise<void> {
  await http.request(identityRoutes.login, input, { handleUnauthorized: false });
  await readSession({ session });
}


/** The session answered by a call that switches who is signed in: read it again, and fail loudly if nobody is. */
async function readSession({ session }: Pick<Platform, "session">): Promise<void> {
  const state = await session.refresh();
  if (state.status === "failed") throw state.error;
  if (state.status !== "authenticated") throw new Error("The server accepted the request but reports nobody signed in.");
}

/**
 * Signs in as somebody else (go-core `login-as`; the server decides who may). Afterwards the session is that
 * person's, with `impersonator` naming the real one. Rejects with the server's refusal
 * (`identity.impersonation.disabled`, a missing or inactive account).
 */
export async function signInAs(platform: Pick<Platform, "http" | "session">, userId: number): Promise<void> {
  await platform.http.request(identityRoutes.loginAs, { user_id: userId });
  await readSession(platform);
}

/**
 * Ends the impersonation: the session is the real person's own again, with no password asked. Rejects with
 * `identity.impersonation.not_active` when the session is not an impersonation.
 */
export async function returnToOwnAccount(platform: Pick<Platform, "http" | "session">): Promise<void> {
  await platform.http.request(identityRoutes.loginAsReturn);
  await readSession(platform);
}
