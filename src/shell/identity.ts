import { computed, type ComputedRef } from "vue";
import { usePlatform } from "../platform/platform";
import { heldSession, type SessionUser } from "../platform/session";

/** Who is signed in, as the account menu shows them. */
export interface ShellIdentity {
  readonly name: string;
  /** A second line under the name (an organisation, an e-mail). */
  readonly detail?: string | null;
}

/**
 * What a user shows as when the application did not say: their `name`, else their id; their `email`
 * as the second line. A session user is only guaranteed an id, so an application whose user has
 * more passes its own `identity`.
 */
export function defaultIdentity(user: SessionUser): ShellIdentity {
  const { name, email } = user as { name?: unknown; email?: unknown };
  return { name: typeof name === "string" && name !== "" ? name : String(user.id), detail: typeof email === "string" ? email : null };
}

/**
 * The signed-in user's identity, for a shell's account menu: null while nobody is signed in.
 *
 *   const identity = useShellIdentity((user: Employee) => ({ name: user.fullName, detail: user.dealer }));
 *
 * `resolve` is typed with the application's own user (the one its session adapter produces).
 */
export function useShellIdentity<U extends SessionUser = SessionUser>(resolve?: (user: U) => ShellIdentity): ComputedRef<ShellIdentity | null> {
  const { session } = usePlatform();
  // The session of this application produces U; the platform only knows it as a SessionUser.
  const read = (resolve ?? defaultIdentity) as (user: SessionUser) => ShellIdentity;
  return computed(() => {
    const held = heldSession(session.state.value);
    return held ? read(held.user) : null;
  });
}
