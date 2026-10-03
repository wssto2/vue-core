import { effectScope, watch } from "vue";
import type { RouteLocationNormalized, RouteLocationRaw, Router } from "vue-router";
import { heldSession, type Session } from "../platform/session";

export interface RouterGuardOptions {
  router: Router;
  session: Session;
  /** The login page (a public route): where an anonymous visitor of a protected route is sent. */
  login: RouteLocationRaw;
  /** Where a signed-in user goes when they open the login page and there is nowhere to return to. */
  home: RouteLocationRaw;
  /**
   * Loads what a navigation needs to show (message namespaces), started as early as it is certain the
   * navigation proceeds and awaited before it lands, in parallel with the view's own chunk. Must not reject.
   */
  prepare?: (to: RouteLocationNormalized) => Promise<void>;
  /** Called when a navigation has landed: the title. */
  afterNavigation?: (to: RouteLocationNormalized) => void;
  /** Begins and ends the page-load indicator. `done` is called exactly once per `start`, whatever way the navigation ends. */
  progress?: { start(): void; done(): void };
  /**
   * True when something on the page asks the person to sign in again when their session expires (the identity
   * feature's sheet): an expired session then stays on its protected page instead of going to the login page.
   * A session that ends any other way still goes to the login page.
   */
  holdExpired?: boolean;
  /** A failure of the session check or of the router (a lazy view that did not load). */
  onError?: (error: unknown) => void;
}

const QUERY = "redirect";

/**
 * Where to go back to after signing in: the `redirect` query of a route, when it is a path inside this
 * app. Anything else (another site, a protocol-relative `//host`, an absolute URL) is ignored, so the
 * login page cannot be made to send a user elsewhere.
 */
export function returnTo(route: Pick<RouteLocationNormalized, "query">): string | null {
  const value = route.query[QUERY];
  const target = Array.isArray(value) ? value[0] : value;
  return typeof target === "string" && target.startsWith("/") && !target.startsWith("//") && !target.includes("\\") ? target : null;
}

function withReturn(login: RouteLocationRaw, target: string | null): RouteLocationRaw {
  if (target === null) return login;
  return typeof login === "string" ? { path: login, query: { [QUERY]: target } } : { ...login, query: { ...login.query, [QUERY]: target } };
}

/**
 * The runtime's route guards, installed on one router:
 *
 * - **Protected by default.** A route needs a signed-in session unless it (or an ancestor) says
 *   `meta.public`. An anonymous visitor is sent to the login page with `?redirect=` to come back.
 *   The session is asked once before the first protected navigation; a failed ask stops the
 *   navigation and is reported (it is not "signed out").
 * - **A signed-in user on the login page** goes to where they were heading, or home.
 * - **A session that ends while a protected page is open** (expired or signed out elsewhere) sends
 *   the user to the login page at once.
 * - The **page-load indicator** and the **title** follow the navigation that actually lands.
 *
 * Access (`meta.access`) is not decided here: a route the user may not open still lands, and shows
 * the no-access state where the page would be (`AppRouterView`), so a permission refresh takes
 * effect without a navigation and there is no redirect to loop on.
 *
 * Returns a function that removes every hook and watcher.
 */
export function installRouterGuards(options: RouterGuardOptions): () => void {
  const { router, session, login, home } = options;
  const preparing = new WeakMap<RouteLocationNormalized, Promise<void>>();
  let indicating = false;

  const start = () => {
    if (indicating) return;
    indicating = true;
    options.progress?.start();
  };
  const done = () => {
    if (!indicating) return;
    indicating = false;
    options.progress?.done();
  };
  const loginName = () => router.resolve(login).name;

  const removeBefore = router.beforeEach(async (to) => {
    start();
    if (to.meta.public === true) {
      if (to.name !== undefined && to.name === loginName() && (await session.restore()).status === "authenticated") return returnTo(to) ?? home;
    } else {
      const state = await session.restore();
      if (state.status === "failed") {
        options.onError?.(state.error);
        return false;
      }
      if (state.status !== "authenticated") return withReturn(login, to.fullPath);
    }
    if (options.prepare) preparing.set(to, options.prepare(to));
    return true;
  });

  const removeResolve = router.beforeResolve(async (to) => {
    await preparing.get(to);
  });

  const removeAfter = router.afterEach((to, _from, failure) => {
    done();
    if (!failure) options.afterNavigation?.(to);
  });

  const removeError = router.onError((error) => {
    done();
    options.onError?.(error);
  });

  // A session that ends under an open protected page.
  const scope = effectScope();
  scope.run(() =>
    watch(
      () => session.state.value,
      (state, before) => {
        if (state.status !== "anonymous" || heldSession(before) === null) return;
        const current = router.currentRoute.value;
        if (current.meta.public === true) return;
        if (state.reason === "expired" && options.holdExpired && state.previous) return; // held: the session kept what it was, a prompt asks for the password
        void router.replace(withReturn(login, state.reason === "expired" ? current.fullPath : null)).catch(options.onError);
      },
    ),
  );

  return () => {
    removeBefore();
    removeResolve();
    removeAfter();
    removeError();
    scope.stop();
    done();
  };
}
