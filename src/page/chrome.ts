import { computed, getCurrentInstance, inject, onBeforeUnmount, shallowRef, toValue, watch, ref, type ComputedRef, type MaybeRefOrGetter, type Ref } from "vue";
import type { App } from "vue";
import { defineFeatureContext } from "../platform/context";
import type { PageAction, PageBack } from "./types";

/** What a page registers: the things the shell (desktop) and the nav bar (phone) render. */
export interface PageChromeRegistration {
  actions: readonly PageAction[];
  leading: PageAction | null;
  status: string | null;
  navTitle: string | null;
}

/** Where the focus and scroll of a list page were when the user left it, to give back on return. */
export interface FocusMemory {
  href: string;
  top: number;
}

/**
 * The page chrome of an app: what the current page wants its toolbar (desktop) and nav bar (phone)
 * to show. Pages and their routed sections register into it through `usePageChrome`; the desktop
 * toolbar renders it inside `AdaptivePageShell` and the app's own phone header reads the state
 * below. Each registration belongs to an owner token, so a page that unmounts after the next one
 * mounted cannot clear the newer page's values.
 *
 * One per app, installed with `installPageChrome`. Nothing is global.
 */
export interface PageChrome {
  /** The back of the current page (its own `back`, or the parent of its `path`); none on a top-level page. */
  readonly back: Readonly<Ref<PageBack | null>>;
  /** The page's large title, for the nav bar to show once the large title has scrolled away. */
  readonly title: Readonly<Ref<string>>;
  readonly titleInView: Readonly<Ref<boolean>>;
  /** The actions of the page and its sections, in the order they registered. */
  readonly actions: ComputedRef<readonly PageAction[]>;
  /** Replaces Back while set (Cancel while editing). */
  readonly leading: ComputedRef<PageAction | null>;
  readonly status: ComputedRef<string | null>;
  /** A nav bar title that stays visible (the name of an edit mode). */
  readonly navTitle: ComputedRef<string | null>;
  /** Whether a page shell is mounted: the app drops its own page padding while one is, since the shell owns the gutters. */
  readonly hasShell: ComputedRef<boolean>;
  /** Takes ownership of the chrome values of one component. */
  claim(): PageChromeOwner;
  /** Registers a mounted page shell; returns its release. */
  claimShell(): () => void;
  readonly focusMemory: { take(url: string): FocusMemory | undefined; put(url: string, memory: FocusMemory): void };
}

export interface PageChromeOwner {
  setBack(back: PageBack | null): void;
  clearBack(): void;
  setTitle(title: string): void;
  setTitleInView(inView: boolean): void;
  clearTitle(): void;
  setRegistration(registration: PageChromeRegistration): void;
  clearRegistration(): void;
}

const FOCUS_MEMORY_LIMIT = 30;

export function createPageChrome(): PageChrome {
  const back = ref<PageBack | null>(null);
  const title = ref("");
  const titleInView = ref(true);
  const registrations = shallowRef(new Map<symbol, PageChromeRegistration>());
  const shells = ref(0);
  const memory = new Map<string, FocusMemory>();

  let backOwner: symbol | null = null;
  let titleOwner: symbol | null = null;

  const entries = computed(() => Array.from(registrations.value.values()));
  const actions = computed(() => entries.value.flatMap((entry) => entry.actions));
  const lastOf = <Key extends "leading" | "status" | "navTitle">(key: Key) =>
    computed(() => entries.value.map((entry) => entry[key]).filter((value) => value != null).pop() ?? null);

  return {
    back,
    title,
    titleInView,
    actions,
    leading: lastOf("leading"),
    status: lastOf("status"),
    navTitle: lastOf("navTitle"),
    hasShell: computed(() => shells.value > 0),
    claimShell() {
      shells.value++;
      let released = false;
      return () => {
        if (!released) shells.value--;
        released = true;
      };
    },
    claim() {
      const owner = Symbol("page-chrome-owner");
      return {
        setBack(value) {
          backOwner = owner;
          back.value = value;
        },
        clearBack() {
          if (backOwner !== owner) return;
          backOwner = null;
          back.value = null;
        },
        setTitle(value) {
          if (titleOwner !== owner) titleInView.value = true;
          titleOwner = owner;
          title.value = value;
        },
        setTitleInView(inView) {
          if (titleOwner === owner) titleInView.value = inView;
        },
        clearTitle() {
          if (titleOwner !== owner) return;
          titleOwner = null;
          title.value = "";
          titleInView.value = true;
        },
        setRegistration(registration) {
          registrations.value = new Map(registrations.value).set(owner, registration);
        },
        clearRegistration() {
          if (!registrations.value.has(owner)) return;
          const next = new Map(registrations.value);
          next.delete(owner);
          registrations.value = next;
        },
      };
    },
    focusMemory: {
      take(url) {
        const found = memory.get(url);
        memory.delete(url);
        return found;
      },
      put(url, value) {
        memory.delete(url);
        memory.set(url, value);
        if (memory.size > FOCUS_MEMORY_LIMIT) memory.delete(memory.keys().next().value ?? "");
      },
    },
  };
}

/** The page chrome context: install one per app; `AdaptivePageShell` provides its own below it when the app has none. */
export const [pageChromeKey, usePageChromeContext] = defineFeatureContext<PageChrome>("vue-core.pageChrome");

/** Creates the page chrome of an app and installs it; returns it for the app's phone header to read. */
export function installPageChrome(app: App): PageChrome {
  const chrome = createPageChrome();
  app.provide(pageChromeKey, chrome);
  return chrome;
}

/** The chrome of an app that installed one, otherwise null. */
export function useOptionalPageChrome(): PageChrome | null {
  return getCurrentInstance() ? inject(pageChromeKey, null) : null;
}

export interface PageChromeOptions {
  /** Actions for the page's toolbar (desktop) and nav bar (phone). */
  actions?: MaybeRefOrGetter<readonly PageAction[] | null | undefined>;
  /** Replaces Back while set, e.g. Cancel while editing. */
  leading?: MaybeRefOrGetter<PageAction | null | undefined>;
  /** A quiet status beside the actions, e.g. "Unsaved changes". */
  status?: MaybeRefOrGetter<string | null | undefined>;
  /** A nav bar title that stays visible (e.g. "Edit customer" while editing). */
  navTitle?: MaybeRefOrGetter<string | null | undefined>;
}

/**
 * Registers page chrome from wherever it is known (the page, or a routed section inside it) and
 * removes it when that component unmounts. `AdaptivePageShell` renders it on desktop and the app's
 * phone header on phones; leaving a section can never leave its Save behind.
 *
 *   usePageChrome({
 *     actions: () => (editing.value ? [save] : [edit]),
 *     leading: () => (editing.value ? cancel : null),
 *     status: () => (dirty.value ? t("unsaved") : null),
 *   });
 *
 * Needs the app's page chrome (`installPageChrome`) when called from the component that renders
 * the shell itself; a section rendered inside a shell also finds the shell's own.
 */
export function usePageChrome(options: PageChromeOptions): void {
  const chrome = usePageChromeContext();
  const owner = chrome.claim();

  watch(
    () => ({
      actions: toValue(options.actions) ?? [],
      leading: toValue(options.leading) ?? null,
      status: toValue(options.status) ?? null,
      navTitle: toValue(options.navTitle) ?? null,
    }),
    (value) => owner.setRegistration(value),
    { immediate: true, deep: true },
  );

  onBeforeUnmount(() => owner.clearRegistration());
}
