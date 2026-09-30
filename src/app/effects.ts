import { effectScope, watch } from "vue";
import type { Platform } from "../platform/platform";
import type { SessionSnapshot, SessionState } from "../platform/session";
import type { AppEffect, EffectStop, FeatureEffect, SessionEffect } from "./feature";

export interface OwnedEffect {
  readonly feature: string;
  readonly effect: FeatureEffect;
}

export interface EffectRunnerOptions {
  effects: readonly OwnedEffect[];
  platform: Platform;
  /**
   * Identifies a session for the session effects: they restart when it changes. Default: the user's
   * id. Return something else (user id plus the active tenant) when a change of scope must restart them.
   */
  sessionKey?: (session: SessionSnapshot) => string;
  /** A failure of starting or stopping an effect, or one an effect reported. */
  onError(error: unknown, effect: OwnedEffect): void;
}

export interface EffectRunner {
  /** Starts the app effects and begins following the session. */
  start(): void;
  /** Aborts and stops everything, in reverse start order. Idempotent. */
  dispose(): void;
}

interface Run {
  readonly controller: AbortController;
  readonly stops: { readonly owned: OwnedEffect; readonly stop: EffectStop }[];
}

/**
 * Starts and stops the effects of an application: app effects once, session effects once per
 * signed-in session (restarted when the user or scope changes, stopped on sign-out or expiry). The
 * session change is followed synchronously, so an old session's effects are aborted before anything
 * else can react to the new state.
 */
export function createEffectRunner(options: EffectRunnerOptions): EffectRunner {
  const { platform } = options;
  const scope = effectScope();
  let appRun: Run | null = null;
  let sessionRun: Run | null = null;
  let disposed = false;

  function begin(entries: readonly OwnedEffect[], start: (owned: OwnedEffect, signal: AbortSignal) => EffectStop | void): Run {
    const controller = new AbortController();
    const run: Run = { controller, stops: [] };
    for (const owned of entries) {
      try {
        const stop = start(owned, controller.signal);
        if (typeof stop === "function") run.stops.push({ owned, stop });
      } catch (error) {
        options.onError(error, owned);
      }
    }
    return run;
  }

  function end(run: Run | null): void {
    if (!run) return;
    run.controller.abort();
    for (const { owned, stop } of run.stops.reverse()) {
      try {
        stop();
      } catch (error) {
        options.onError(error, owned);
      }
    }
  }

  const ofScope = <S extends FeatureEffect["scope"]>(wanted: S) =>
    options.effects.filter((owned): owned is OwnedEffect & { effect: Extract<FeatureEffect, { scope: S }> } => owned.effect.scope === wanted);

  const keyOf = (state: SessionState): string | null =>
    state.status !== "authenticated" ? null : options.sessionKey ? options.sessionKey(state) : String(state.user.id);

  return {
    start() {
      if (disposed || appRun) return;
      appRun = begin(ofScope("app"), (owned, signal) =>
        (owned.effect as AppEffect).start({ signal, platform, report: (error) => options.onError(error, owned) }),
      );

      const sessionEffects = ofScope("session");
      scope.run(() =>
        watch(
          () => keyOf(platform.session.state.value),
          (key) => {
            end(sessionRun);
            sessionRun = null;
            const state = platform.session.state.value;
            if (key === null || state.status !== "authenticated") return;
            sessionRun = begin(sessionEffects, (owned, signal) =>
              (owned.effect as SessionEffect).start({ signal, platform, user: state.user, report: (error) => options.onError(error, owned) }),
            );
          },
          { immediate: true, flush: "sync" },
        ),
      );
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      scope.stop();
      end(sessionRun);
      end(appRun);
      sessionRun = appRun = null;
    },
  };
}
