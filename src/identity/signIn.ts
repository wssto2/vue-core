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
  const state = await session.refresh();
  if (state.status === "failed") throw state.error;
  if (state.status !== "authenticated") throw new Error("The server accepted the sign-in but reports nobody signed in.");
}

