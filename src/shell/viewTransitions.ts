import { defineComponent, nextTick, onScopeDispose } from "vue";
import { useRouter, type RouteLocationNormalized, type Router } from "vue-router";
import { defineFeature, type Feature } from "../app/feature";
import { SCROLL_LOCK_CLASS } from "../overlay/dialogStack";

/** Longest a navigation may hold the old screen before we let go anyway. */
const MAX_WAIT_MS = 1000;

const depth = (route: RouteLocationNormalized) => route.path.split("/").filter(Boolean).length;

/**
 * Native-style screen transitions on phones and tablets (View Transitions API): going deeper (list
 * to record) slides the new screen in from the right, going back slides it out again. Sections of
 * the same record (its tab bar) and filter/query changes swap in place, as a native tab bar does.
 *
 * Off on desktop, for reduced motion, while a dialog is open, and in browsers without the API (the
 * navigation simply happens). The top bar, the sidebar and the bottom dock have view-transition
 * names in the library's stylesheet, so they stay put while the page slides. Returns the function
 * that removes every hook it added.
 */
export function installViewTransitions(router: Router): () => void {
  if (typeof document === "undefined" || typeof document.startViewTransition !== "function") return () => undefined;

  let finish: (() => void) | null = null;

  const shouldAnimate = () =>
    window.matchMedia("(max-width: 1023px)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    !document.body.classList.contains(SCROLL_LOCK_CLASS);

  const removeResolve = router.beforeResolve((to, from) => {
    // A navigation that begins while the last one still holds the old screen lets it go: the page must never wait for a slide nobody sees.
    release();
    // The first navigation, a query-only change, or no depth change: no slide.
    if (!from.matched.length || to.path === from.path || !shouldAnimate()) return;

    const direction = depth(to) > depth(from) ? "forward" : depth(to) < depth(from) ? "back" : null;
    if (!direction) return;

    const root = document.documentElement;
    root.dataset.navDirection = direction;

    return new Promise<void>((resolveGuard) => {
      const transition = document.startViewTransition(
        () =>
          new Promise<void>((done) => {
            const timeout = setTimeout(done, MAX_WAIT_MS);
            finish = () => {
              clearTimeout(timeout);
              done();
            };
            resolveGuard();
          }),
      );

      // A navigation that starts before this one settles aborts the transition: `ready` and `finished`
      // then reject, which would surface as an uncaught error on every quick tap. The navigation itself
      // still completes; only the animation is dropped.
      transition.ready.catch(() => undefined);
      void transition.finished
        .catch(() => undefined)
        .finally(() => {
          if (root.dataset.navDirection === direction) delete root.dataset.navDirection;
        });
    });
  });

  // The new screen is rendered one tick after the navigation lands; release then.
  function release() {
    const done = finish;
    finish = null;
    if (done) void nextTick().then(done);
  }

  const removeAfter = router.afterEach(release);
  const removeError = router.onError(release);

  return () => {
    removeResolve();
    removeAfter();
    removeError();
    delete document.documentElement.dataset.navDirection;
    finish?.();
    finish = null;
  };
}

/** What `viewTransitions()` mounts: installs the transitions while the application runs and removes them when it is disposed. */
const ViewTransitions = defineComponent({
  name: "ViewTransitions",
  setup() {
    onScopeDispose(installViewTransitions(useRouter()));
    return () => null;
  },
});

/**
 * Screen transitions between pages on phones and tablets, as an opt-in feature:
 *
 *   createApplication({ platform, features: [identity, tickets, viewTransitions()], shell: backofficeShell() })
 *
 * It mounts in the shell's `host` slot. The transitions themselves are `installViewTransitions(router)`.
 */
export function viewTransitions(): Feature {
  return defineFeature({
    id: "vue-core.view-transitions",
    contributions: [{ id: "vue-core.view-transitions", slot: "host", component: ViewTransitions, scope: "always" }],
  });
}
