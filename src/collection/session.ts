import { hasInjectionContext, inject, watch } from "vue";
import { platformKey } from "../platform";

/**
 * Calls `callback` whenever who is signed in changes (a sign-in, a sign-out, another person), with the
 * new person's id or null. A list holds one person's data: what it loaded, cached or saved for the
 * previous session must not reach the next. Does nothing where no platform is installed (a
 * component test), because then there is no session to follow.
 */
export function onSessionChange(callback: (identity: string | number | null) => void): void {
  if (!hasInjectionContext()) return;
  const platform = inject(platformKey, null);
  if (!platform) return;
  watch(
    () => {
      const state = platform.session.state.value;
      return state.status === "authenticated" ? state.user.id : null;
    },
    callback,
    { flush: "sync" },
  );
}
