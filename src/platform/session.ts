import { shallowRef, type ShallowRef } from "vue";
import type { AccessSnapshot } from "./access";
import type { NavigationNode } from "./navigation";

/** The minimal projection of the signed-in user the platform needs; an application's own user type extends it. */
export interface SessionUser {
  readonly id: number | string;
}

/** What the server says about a session. */
export interface SessionSnapshot<U extends SessionUser = SessionUser> {
  readonly user: U;
  /** When the session's access token expires, if the server says; renewing it is the application's effect. */
  readonly expiresAt: Date | null;
  readonly access: AccessSnapshot;
  /** The menu the server built for this user; absent when the adapter's backend has none. */
  readonly navigation?: readonly NavigationNode[];
}

/**
 * Why nobody is signed in: `none` (the server has no session for this browser), `expired` (a request was
 * answered 401 while signed in) or `signedOut` (the user ended it). A login page can say which.
 */
export type SessionEnd = "none" | "expired" | "signedOut";

export type SessionState<U extends SessionUser = SessionUser> =
  /** Nobody has asked the server yet. */
  | { readonly status: "unknown" }
  | { readonly status: "loading" }
  | { readonly status: "anonymous"; readonly reason: SessionEnd }
  | ({ readonly status: "authenticated" } & SessionSnapshot<U>)
  /** The server could not say (network, 5xx, unreadable answer): not the same as signed out. */
  | { readonly status: "failed"; readonly error: unknown };

/** The seam to a backend: how to ask who is signed in and how to end the session. */
export interface SessionAdapter<U extends SessionUser = SessionUser> {
  /** The current session, or null when there is none (not signed in). Reject for failures; honour `signal`. */
  load(signal: AbortSignal): Promise<SessionSnapshot<U> | null>;
  /** Ends the session on the server. */
  signOut(): Promise<void>;
}

/**
 * Work that must happen while the session still exists, right before it ends: removing this device's push
 * subscription, flushing a draft. `signal` aborts when the hook ran out of time.
 */
export type BeforeSignOutHook<U extends SessionUser = SessionUser> = (user: U, signal: AbortSignal) => void | Promise<void>;

/** The longest `signOut()` waits for its hooks; the sign-out goes on after that. */
export const beforeSignOutTimeout = 3000;

/**
 * The current session of one platform. `state` is reactive; every change of who is signed in cancels
 * the requests of the previous state and drops their late answers, so one session never leaks into the next.
 */
export interface Session<U extends SessionUser = SessionUser> {
  readonly state: Readonly<ShallowRef<SessionState<U>>>;
  /** Asks the server who is signed in, once: a known state is returned as it is. Never rejects; see `failed`. */
  restore(): Promise<SessionState<U>>;
  /** Asks the server again (policy refresh). Concurrent calls share one request. While signed in, a failed refresh keeps the session as it is. */
  refresh(): Promise<SessionState<U>>;
  /** A sign-in succeeded: the application's login call produced this snapshot. */
  establish(snapshot: SessionSnapshot<U>): void;
  /** The server rejected the session (401): signed in becomes anonymous with reason `expired`. No-op when nobody is signed in. */
  expire(): void;
  /**
   * Runs the before-sign-out hooks (together, at most `beforeSignOutTimeout` ms; a failing or late one is reported
   * to `onError` and never blocks), then signs out locally (state cleared before anything else can read it), then
   * ends the session on the server; rejects if that call fails. Concurrent calls share one sign-out.
   */
  signOut(): Promise<void>;
  /**
   * Adds a hook `signOut()` runs while the user is still signed in. Returns the function that removes it: a
   * session effect returns it as its stop, so the hook lives exactly as long as the effect.
   */
  onBeforeSignOut(hook: BeforeSignOutHook<U>): () => void;
}

export interface SessionOptions<U extends SessionUser = SessionUser> {
  /** Called with the failure of a load (also when the state is kept because the user is signed in) or of a before-sign-out hook: log it. */
  onError?: (error: unknown) => void;
  /** A hook every sign-out runs first (see `Session.onBeforeSignOut` for the ones a feature adds). */
  beforeSignOut?: BeforeSignOutHook<U>;
  /** Called after `expire()` moved a signed-in session to anonymous. */
  onExpired?: () => void;
}

export function createSession<U extends SessionUser = SessionUser>(
  adapter: SessionAdapter<U>,
  options: SessionOptions<U> = {},
): Session<U> {
  const state = shallowRef<SessionState<U>>({ status: "unknown" });
  let epoch = 0; // bumped by every change of who is signed in
  const hooks = new Set<BeforeSignOutHook<U>>(options.beforeSignOut ? [options.beforeSignOut] : []);
  let signingOut: Promise<void> | null = null;
  let current: { controller: AbortController; promise: Promise<SessionState<U>> } | null = null;

  function supersede(): void {
    epoch++;
    current?.controller.abort();
    current = null;
  }

  /** Runs the hooks with the signed-in user; never rejects, never takes longer than `beforeSignOutTimeout`. */
  async function runHooks(user: U): Promise<void> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        options.onError?.(new Error(`A before-sign-out hook did not finish within ${beforeSignOutTimeout} ms; signing out without it.`));
        resolve();
      }, beforeSignOutTimeout);
    });
    const all = Promise.all(
      [...hooks].map(async (hook) => {
        try {
          await hook(user, controller.signal);
        } catch (error) {
          options.onError?.(error);
        }
      }),
    ).then(() => undefined);
    await Promise.race([all, timeout]);
    clearTimeout(timer);
  }

  function ask(): Promise<SessionState<U>> {
    if (current) return current.promise;
    const mine = epoch;
    const controller = new AbortController();
    const previous = state.value;
    if (previous.status !== "authenticated") state.value = { status: "loading" };

    const run = async (): Promise<SessionState<U>> => {
      try {
        const snapshot = await adapter.load(controller.signal);
        if (epoch !== mine) return state.value;
        state.value = snapshot ? { status: "authenticated", ...snapshot } : { status: "anonymous", reason: "none" };
      } catch (error) {
        if (epoch !== mine) return state.value;
        options.onError?.(error);
        // A transient failure must not sign a user out or throw away unsaved work.
        state.value = previous.status === "authenticated" ? previous : { status: "failed", error };
      } finally {
        if (epoch === mine) current = null;
      }
      return state.value;
    };
    const promise = Promise.resolve().then(run); // `current` is set before `run` can finish
    current = { controller, promise };
    return promise;
  }

  return {
    state,
    restore: () => (state.value.status === "unknown" || state.value.status === "failed" ? ask() : current?.promise ?? Promise.resolve(state.value)),
    refresh: ask,
    establish(snapshot) {
      supersede();
      state.value = { status: "authenticated", ...snapshot };
    },
    expire() {
      if (state.value.status !== "authenticated") return;
      supersede();
      state.value = { status: "anonymous", reason: "expired" };
      options.onExpired?.();
    },
    signOut() {
      signingOut ??= (async () => {
        try {
          const before = state.value;
          if (before.status === "authenticated" && hooks.size > 0) await runHooks(before.user); // no hooks: the state clears synchronously
          supersede();
          state.value = { status: "anonymous", reason: "signedOut" };
          await adapter.signOut();
        } finally {
          signingOut = null;
        }
      })();
      return signingOut;
    },
    onBeforeSignOut(hook) {
      hooks.add(hook);
      return () => void hooks.delete(hook);
    },
  };
}
