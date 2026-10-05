import type { Platform } from "../platform/platform";
import type { SessionEffect } from "./feature";

export interface KeepSessionAliveOptions {
  /** How long before the session expires it is renewed. Default 60 000 ms. */
  margin?: number;
  /**
   * The server call that renews the session (a refresh-token request). After it the session is read
   * again, which brings the new expiry. Without it the session is only read again.
   */
  renew?: (platform: Platform) => Promise<void>;
  /** When a renewal did not move the expiry, how long to wait before trying again. Default 30 000 ms. */
  retryAfter?: number;
}

// setTimeout keeps its delay in 32 bits: past ~24.8 days it fires at once. A long session just re-checks daily.
const LONGEST_WAIT = 86_400_000;

/**
 * Keeps an open app signed in: renews the session shortly before it expires (a timer) and catches up
 * when the app comes back to the foreground or the network returns, since timers do not run while a
 * phone sleeps. Skipped while offline. Opt in by listing it in a feature's `effects`:
 *
 *   defineFeature({ id: "session", effects: [keepSessionAlive({ renew: (platform) => platform.http.post("/auth/refresh").then(() => {}) })] })
 *
 * A session with no expiry has nothing to renew.
 */
export function keepSessionAlive(options: KeepSessionAliveOptions = {}): SessionEffect {
  const { margin = 60_000, retryAfter = 30_000 } = options;
  return {
    id: "vue-core.keep-session-alive",
    scope: "session",
    start({ signal, platform, report }) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let inFlight: Promise<void> | null = null;

      /** Milliseconds until renewal is due; null when there is nothing to renew. */
      const untilDue = (): number | null => {
        const state = platform.session.state.value;
        return state.status === "authenticated" && state.expiresAt ? state.expiresAt.getTime() - Date.now() - margin : null;
      };

      const renew = (): Promise<void> => {
        inFlight ??= (async () => {
          try {
            await options.renew?.(platform);
            // A renew that ended the session (expired it on a refused refresh) stays ended: reading the session
            // again would sign it back in on a still-valid access token, and the new session would renew at once.
            if (platform.session.state.value.status !== "authenticated") return;
            await platform.session.refresh();
          } catch (error) {
            report(error);
          } finally {
            inFlight = null;
          }
        })();
        return inFlight;
      };

      function schedule(minimum = 0) {
        clearTimeout(timer);
        const due = untilDue();
        if (due !== null && !signal.aborted) timer = setTimeout(() => void check(), Math.min(Math.max(due, minimum), LONGEST_WAIT));
      }

      async function check() {
        if (signal.aborted || !navigator.onLine) return;
        const due = untilDue();
        if (due === null) return;
        if (due <= 0) {
          await renew();
          // A late answer after sign-out or disposal must not start a timer again.
          if (signal.aborted) return;
          schedule((untilDue() ?? 1) <= 0 ? retryAfter : 0); // the expiry did not move: do not spin
          return;
        }
        schedule();
      }

      const onVisible = () => {
        if (document.visibilityState === "visible") void check();
      };
      const onOnline = () => void check();
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("online", onOnline);
      void check();

      return () => {
        clearTimeout(timer);
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener("online", onOnline);
      };
    },
  };
}
