import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useDescribeError } from "../i18n";
import { toast } from "../overlay";
import { heldSession, usePlatform } from "../platform";
import { useIdentityContext } from "./context";
import { isSessionEnded, returnToOwnAccount } from "./signIn";

/**
 * Leaving an impersonation, for the banner and the account menu row: `impersonating` says whether the session is somebody
 * else's, `leave()` returns to one's own account and lands on the home page (what was on screen belonged to the other
 * person). A refusal is said in a toast and the session is read again, since the impersonation may have ended elsewhere.
 */
export function useReturnToOwnAccount() {
  const platform = usePlatform();
  const router = useRouter();
  const { home } = useIdentityContext();
  const describeError = useDescribeError();
  const returning = ref(false);
  const impersonating = computed(() => heldSession(platform.session.state.value)?.impersonator != null);

  async function leave() {
    returning.value = true;
    try {
      await returnToOwnAccount(platform);
      await router.push(home);
    } catch (error) {
      if (!isSessionEnded(error)) toast.error(describeError(error));
      void platform.session.refresh();
    } finally {
      returning.value = false;
    }
  }

  return { impersonating, returning, leave };
}
