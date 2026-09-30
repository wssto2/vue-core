import { inject, onBeforeUnmount, onMounted, shallowRef, type App, type ShallowRef } from "vue";
import { matchedRouteKey, onBeforeRouteLeave, onBeforeRouteUpdate, type RouteLocationNormalized } from "vue-router";
import { defineFeatureContext } from "../platform/context";

/** The open "discard changes?" question: where the user was going (null: a dismissal, not a navigation) and how to answer it. */
export interface PendingLeave {
  readonly to: RouteLocationNormalized | null;
  readonly decision: Promise<boolean>;
  /** Answers the question; true lets the user go. */
  resolve(leave: boolean): void;
}

/**
 * The unsaved-changes question of an app: who has something to lose, and the one dialog that asks
 * (`LeaveGuardRoot`). One per app, installed with `installLeaveGuard`; nothing is global.
 */
export interface LeaveGuard {
  /** The question on screen, read by `LeaveGuardRoot`. */
  readonly pending: Readonly<ShallowRef<PendingLeave | null>>;
  /**
   * Asks whether the user may leave. One question at a time: a second ask for the same navigation (two
   * dirty forms on a page) shares the answer, an ask while a dismissal is open shares that one, and a newer
   * navigation answers the older unanswered one with "stay".
   */
  confirm(to?: RouteLocationNormalized | null): Promise<boolean>;
  /** Registers a dirty check for as long as its owner lives; returns the release. */
  register(isDirty: () => boolean): () => void;
  /** Whether any registered check has unsaved changes (before a pull to refresh, say). */
  hasUnsavedChanges(): boolean;
}

export function createLeaveGuard(): LeaveGuard {
  const pending = shallowRef<PendingLeave | null>(null);
  const checks = new Set<() => boolean>();
  // One answer per navigation: every guard of the same navigation receives the same `to` object.
  const decisions = new WeakMap<RouteLocationNormalized, Promise<boolean>>();

  function confirm(to: RouteLocationNormalized | null = null): Promise<boolean> {
    const known = to ? decisions.get(to) : undefined;
    if (known) return known;
    const open = pending.value;
    if (open && to === null && open.to === null) return open.decision;
    open?.resolve(false);

    let resolve!: (leave: boolean) => void;
    const decision = new Promise<boolean>((done) => (resolve = done));
    const question: PendingLeave = {
      to,
      decision,
      resolve: (leave) => {
        if (pending.value === question) pending.value = null;
        resolve(leave);
      },
    };
    pending.value = question;
    if (to) decisions.set(to, decision);
    return decision;
  }

  return {
    pending,
    confirm,
    register(isDirty) {
      checks.add(isDirty);
      return () => checks.delete(isDirty);
    },
    hasUnsavedChanges: () => [...checks].some((isDirty) => isDirty()),
  };
}

export const [leaveGuardKey, useLeaveGuardContext] = defineFeatureContext<LeaveGuard>("vue-core.leaveGuard");

/** Creates the app's leave guard and installs it; mount `<LeaveGuardRoot />` once (in the shell) to show its question. */
export function installLeaveGuard(app: App): LeaveGuard {
  const guard = createLeaveGuard();
  app.provide(leaveGuardKey, guard);
  return guard;
}

/**
 * Asks before leaving a page, or closing a sheet, with unsaved changes.
 *
 *   const { confirmDiscard } = useLeaveGuard(() => form.dirty.value);
 *
 * Covers every way out of the page: in-app navigation (links, the browser's back and forward: the
 * router waits for the answer), moving to another record on the same route (only when the path changes),
 * and reloading or closing the tab (the browser's own prompt). A screen that switches records without
 * touching the router asks itself: `if (await confirmDiscard()) load(next)`. `isDirty` is read at that
 * moment, so a form whose baseline moved on save lets the redirect after it through.
 *
 * Needs the app's guard (`installLeaveGuard`).
 */
export function useLeaveGuard(isDirty: () => boolean): { confirmDiscard: () => Promise<boolean> } {
  const guard = useLeaveGuardContext();
  // Outside a <router-view> (a component test, a dialog mounted at the root) there is no route to leave; only the unload prompt applies.
  if (inject(matchedRouteKey, null)) {
    onBeforeRouteLeave((to) => (isDirty() ? guard.confirm(to) : true));
    onBeforeRouteUpdate((to, from) => (to.path !== from.path && isDirty() ? guard.confirm(to) : true));
  }

  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (!isDirty()) return;
    event.preventDefault();
    event.returnValue = ""; // older browsers only show the prompt when this is set
  }

  let release: (() => void) | null = null;
  onMounted(() => {
    window.addEventListener("beforeunload", onBeforeUnload);
    release = guard.register(isDirty);
  });
  onBeforeUnmount(() => {
    window.removeEventListener("beforeunload", onBeforeUnload);
    release?.();
  });

  return { confirmDiscard: async () => !isDirty() || guard.confirm() };
}
