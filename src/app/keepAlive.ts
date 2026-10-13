import type { SessionEffect } from "./feature";

export interface KeepSessionAliveOptions {
  /** How long before the session expires it is renewed. Default 60 000 ms. */
  margin?: number;
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
 *   defineFeature({ id: "session", effects: [keepSessionAlive()] })
 *
 * It renews through `platform.session.renew()`, the platform's `renewSession`, the same single renewal a 401 uses,
 * so a timer and a failed request never present the refresh token twice. A session with no expiry, or one that is
 * not `renewable` (no `renewSession`, or an embed session), has nothing to renew and the effect stays idle.
 */
export function keepSessionAlive(options: KeepSessionAliveOptions = {}): SessionEffect {
  const { margin = 60_000, retryAfter = 30_000 } = options;
  return {
    id: "vue-core.keep-session-alive",
    scope: "session",
    start({ signal, platform, report }) {
      let timer: ReturnType<typeof setTimeout> | undefined;

      /** Milliseconds until renewal is due; null when there is nothing to renew. */
      const untilDue = (): number | null => {
        const state = platform.session.state.value;
        return platform.session.renewable && state.status === "authenticated" && state.expiresAt ? state.expiresAt.getTime() - Date.now() - margin : null;
      };

      // `session.renew()` is single-flight and ends the session itself when the renewal is refused.
      const renew = async (): Promise<void> => {
        try {
          await platform.session.renew();
        } catch (error) {
          report(error);
        }
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
