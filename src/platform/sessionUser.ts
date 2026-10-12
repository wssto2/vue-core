import { computed, type ComputedRef } from "vue";
import { usePlatform } from "./platform";
import type { RegisteredUser } from "./index";

/**
 * The signed-in user, typed from `PlatformRegistry`, or `null` while nobody is signed in (also while a session
 * that expired is held on screen: it is not a signed-in user). Follows the session, so a user changed in place
 * (`session.update({ user })`) reaches the reader. The impersonator stays on `session.state`.
 */
export function useSessionUser(): Readonly<ComputedRef<RegisteredUser | null>> {
  const { session } = usePlatform();
  return computed(() => {
    const state = session.state.value;
    return state.status === "authenticated" ? state.user : null;
  });
}
