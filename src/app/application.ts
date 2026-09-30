import { computed, createApp, defineComponent, h, shallowRef, watch, effectScope, type App, type Component } from "vue";
import { createI18n, type PluralizationRule } from "vue-i18n";
import {
  createRouter,
  isNavigationFailure,
  type RouteLocationNormalized,
  type RouteLocationRaw,
  type RouteRecordRaw,
  type Router,
  type RouterHistory,
  type RouterScrollBehavior,
} from "vue-router";
import { createFormatting, formattingKey, installFormatting, type Formatters, type Formatting } from "../format";
import { coreMessages, createMessageRuntime, type MessageNamespace } from "../i18n";
import { iconSetKey } from "../icon/environment";
import { installIcons, type IconSet } from "../icon";
import { bottomDockKey, installBottomDock, installPageChrome, pageChromeKey, type PageChrome } from "../page";
import { installPlatform, platformKey, type Platform, type SessionSnapshot } from "../platform";
import { AppRouterView, createRouteAccess, routeAccessKey } from "../router/access";
import { createAppHistory } from "../router/history";
import { installRouterGuards } from "../router/guards";
import type { NavigationCatalogue } from "../router/navigation";
import { bindNavigation, createNavigation, navigationKey } from "../router/navigation";
import NoAccess from "../router/NoAccess.vue";
import { createShellContributions, shellContributionsKey, type OwnedContribution } from "./contributions";
import { applicationKey, type ApplicationEnvironment, type ApplicationState } from "./environment";
import { createEffectRunner, type OwnedEffect } from "./effects";
import type { Feature, ShellSlot } from "./feature";
import StartupFailure from "./StartupFailure.vue";
import { ApplicationError, validateComposition, type CompositionIssue } from "./validate";

/** A shell that says which slots it renders, so a contribution to a slot it lacks fails at startup instead of vanishing. */
export interface ShellDefinition {
  readonly component: Component;
  readonly slots: readonly ShellSlot[];
  /** The shell's page-load indicator; used as `router.progress` unless the application sets its own. */
  readonly progress?: { start(): void; done(): void };
}

/** Where an error the application caught came from. */
export interface ApplicationErrorReport {
  readonly source: "vue" | "unhandledrejection" | "window" | "effect" | "messages" | "session" | "router" | "locale";
  readonly error: unknown;
  /** The route the user was on, when there was one. */
  readonly route: string | null;
  /** The feature that owns the failing effect or message namespace, when known. */
  readonly feature?: string;
  readonly detail?: string;
}

export interface ApplicationRouterOptions {
  /** Default: `createAppHistory()` (web history; replace-only in the iOS home-screen app). */
  history?: RouterHistory;
  /** The login page (a route with `meta.public`). Default `{ name: "login" }`. */
  login?: RouteLocationRaw;
  /** Where a signed-in user who opens the login page goes. Default `/`. */
  home?: RouteLocationRaw;
  scrollBehavior?: RouterScrollBehavior;
  /** The page-load indicator: `start` when a navigation begins, `done` when it ended, however it ended. */
  progress?: { start(): void; done(): void };
  /** The browser tab title for the current page (`null`: the route has none). Default `Page · App name`. */
  documentTitle?: (page: string | null, appName: string | null) => string;
}

export interface ApplicationI18nOptions {
  /** The application's own texts per locale, merged over the library's `core` messages (they may override any of its keys). */
  messages?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  /** Plural rules per locale (Slavic languages need their own). */
  pluralRules?: Readonly<Record<string, PluralizationRule>>;
  /** Warn about missing keys in development. Default true. */
  missingWarn?: boolean;
}

export interface ApplicationLocaleOptions {
  /** The locale to start in. Default: the server's (`platform.config.locale`) when supported, else `fallback`. */
  initial?: string;
  /** The locale whose texts stand in for missing ones. Default `en`. */
  fallback?: string;
  /** The locales the application offers. Default: the library's (`en`, `hr`, `bs`, `sl`). */
  supported?: readonly string[];
}

export interface ApplicationOptions {
  /** The app-scoped services (`createPlatform`). */
  platform: Platform;
  /** What is installed, in presentation order. Each is one `defineFeature`. */
  features: readonly Feature[];
  /** The layout around the routed page: a component (renders `<AppRouterView />` and the `ShellOutlet`s it offers) or a `ShellDefinition`. Default: the routed page alone. */
  shell?: Component | ShellDefinition;
  router?: ApplicationRouterOptions;
  i18n?: ApplicationI18nOptions;
  locale?: ApplicationLocaleOptions;
  /** Replace any of the `Intl` formatters (ARV shows `DD.MM.YYYY.`). */
  formatting?: Partial<Formatters>;
  /** Message namespaces the application or its shell owns itself, outside any feature. */
  messages?: readonly MessageNamespace[];
  /** The application's icons (`installIcons`): one set, or several partial ones (a feature's own) that are merged. */
  icons?: IconSet | readonly IconSet[];
  /** The backend's destination catalogue, for validating the features' bindings. */
  navigation?: NavigationCatalogue;
  /** What stands in place of a page the user may not open. */
  noAccess?: Component;
  /** Identifies a session for session effects: they restart when it changes. Default: the user's id. */
  sessionKey?: (session: SessionSnapshot) => string;
  /**
   * Called after a switch to another locale committed (not for the start locale, a switch to the locale already active, or a
   * switch a later one superseded), so the application can save the choice on the user. Not awaited: the page has already
   * changed; a failure (thrown or rejected) is reported to `onError` with `source: "locale"`.
   */
  onLocaleChange?: (locale: string) => void | Promise<void>;
  /** Called with every error the application catches (component errors, unhandled rejections, failed effects and loads). Default: `console.error`. */
  onError?: (report: ApplicationErrorReport) => void;
}

export interface Application {
  /** The Vue app, for the few things that need it (a plugin, a test). */
  readonly app: App;
  readonly router: Router;
  /** The vue-i18n instance of this application. */
  readonly i18n: ApplicationI18n;
  readonly state: ApplicationEnvironment["state"];
  readonly locale: ApplicationEnvironment["locale"];
  setLocale: ApplicationEnvironment["setLocale"];
  /**
   * Starts the application and mounts it: restores the session, loads the essential texts, runs the
   * first navigation, then renders. A failure of the session or the texts mounts the failure view
   * (`state` says which, the user can retry) instead of rejecting.
   */
  mount(target: string | Element): Promise<void>;
  /** Tries the start again after it failed. */
  retry(): Promise<void>;
  /** Unmounts and removes everything the application installed: guards, listeners, effects, timers. Idempotent. */
  dispose(): void;
}

const buildI18n = (locale: string, fallbackLocale: string, options: ApplicationI18nOptions | undefined) =>
  createI18n({
    legacy: false,
    locale,
    fallbackLocale,
    pluralRules: options?.pluralRules && { ...options.pluralRules },
    ...(options?.missingWarn === false && { missingWarn: false, fallbackWarn: false }),
    messages: {},
  });

/** The vue-i18n instance of an application (composition mode). */
export type ApplicationI18n = ReturnType<typeof buildI18n>;

const isShellDefinition = (shell: Component | ShellDefinition): shell is ShellDefinition =>
  typeof shell === "object" && shell !== null && "component" in shell && "slots" in shell;

/** Clones the records marked as the feature's: the declaration stays pure and two applications never share a record. */
function ownedRecords(records: readonly RouteRecordRaw[], feature: string): RouteRecordRaw[] {
  return records.map((record) => ({
    ...record,
    meta: { ...record.meta, feature },
    ...(record.children && { children: ownedRecords(record.children, feature) }),
  })) as RouteRecordRaw[];
}

const unique = <T>(values: readonly T[]) => [...new Set(values)];

/**
 * The composition root of an application: installs the platform, localization, page chrome, icons,
 * feature contexts, guards and the router, then the shell, in that order, and validates the whole
 * composition first. Nothing runs (no request, timer or listener) until `mount()`.
 *
 *   const application = createApplication({ platform, features: [identityFeature, ticketsFeature], shell: BackofficeShell });
 *   await application.mount("#app");
 *
 * Throws an `ApplicationError` listing every problem (duplicate feature ids, route names, contexts,
 * message namespaces, destinations; missing login route), each naming its owner.
 */
export function createApplication(options: ApplicationOptions): Application {
  const { platform } = options;
  const supportedLocales = options.locale?.supported ?? (Object.keys(coreMessages) as string[]);
  const fallbackLocale = options.locale?.fallback ?? "en";
  const shell = options.shell === undefined ? undefined : isShellDefinition(options.shell) ? options.shell : { component: options.shell, slots: undefined, progress: undefined };

  // --- 1. validate the composition; nothing is built from an invalid one
  const appIssues: CompositionIssue[] = [];
  if (!supportedLocales.includes(fallbackLocale)) appIssues.push({ owner: "application", message: `the fallback locale "${fallbackLocale}" is not among the supported locales (${supportedLocales.join(", ")}).` });
  const initialLocale = options.locale?.initial ?? (supportedLocales.includes(platform.config.locale) ? platform.config.locale : fallbackLocale);
  if (!supportedLocales.includes(initialLocale)) appIssues.push({ owner: "application", message: `the initial locale "${initialLocale}" is not among the supported locales (${supportedLocales.join(", ")}).` });

  const reservedContexts = [platformKey, formattingKey, pageChromeKey, bottomDockKey, iconSetKey, navigationKey, shellContributionsKey, routeAccessKey, applicationKey];
  const composition = validateComposition({
    features: options.features,
    platform,
    messages: options.messages ?? [],
    reservedContexts,
    supportedLocales,
    shellSlots: shell?.slots,
  });
  const issues = [...appIssues, ...composition.issues];

  const features = composition.features;
  const navigationBindings = bindNavigation(
    features.flatMap((feature) => feature.navigation.map((binding) => ({ feature: feature.id, binding }))),
    options.navigation,
  );
  for (const message of navigationBindings.issues) issues.push({ owner: "navigation", message });
  if (issues.length > 0) throw new ApplicationError(issues);

  // --- 2. build: platform is given; i18n, formatting, router, runtime pieces
  const i18n = buildI18n(initialLocale, fallbackLocale, options.i18n);
  const composer = i18n.global;
  for (const [locale, messages] of Object.entries(coreMessages)) composer.mergeLocaleMessage(locale, messages);
  for (const [locale, messages] of Object.entries(options.i18n?.messages ?? {})) composer.mergeLocaleMessage(locale, messages as Record<string, unknown>);

  const formatting: Formatting = createFormatting({ locale: () => composer.locale.value, formatters: options.formatting });

  const namespaces = [...features.flatMap((feature) => feature.messages), ...(options.messages ?? [])];
  const report = (value: Omit<ApplicationErrorReport, "route">) =>
    (options.onError ?? defaultOnError)({ ...value, route: router.currentRoute.value.matched.length > 0 ? router.currentRoute.value.fullPath : null });
  const messages = createMessageRuntime({
    target: composer,
    namespaces,
    fallback: fallbackLocale,
    supported: supportedLocales,
    onFailure: (failure) => report({ source: "messages", error: failure.error, detail: `${failure.namespace} (${failure.locale})`, feature: ownerOfNamespace.get(failure.namespace) }),
  });
  const ownerOfNamespace = new Map(features.flatMap((feature) => feature.messages.map((entry) => [entry.namespace, feature.id] as const)));

  const router = createRouter({
    history: options.router?.history ?? createAppHistory(),
    routes: features.flatMap((feature) => ownedRecords(feature.routes, feature.id)),
    scrollBehavior: options.router?.scrollBehavior ?? ((to, from) => (to.name === from.name ? false : { top: 0 })),
  });
  const login = options.router?.login ?? { name: "login" };
  const home = options.router?.home ?? { path: "/" };

  const routerIssues: CompositionIssue[] = [];
  /** Why `to` opens nothing, or null when it resolves to a route. vue-router throws for an unknown name or a missing parameter. */
  const unresolved = (to: RouteLocationRaw): string | null => {
    try {
      return router.resolve(to).matched.length > 0 ? null : "matches no route";
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return reason.startsWith("No match for") ? "matches no route" : `cannot be resolved (${reason})`;
    }
  };
  const hasProtectedRoutes = features.some((feature) => feature.routes.some((record) => record.meta?.public !== true));
  if (hasProtectedRoutes) {
    const problem = unresolved(login) ?? (router.resolve(login).meta.public === true ? null : "is not public (meta.public: true)");
    if (problem) {
      routerIssues.push({ owner: "application", message: `the login route ${JSON.stringify(login)} ${problem.replace("matches no route", "does not exist")}, but protected routes are installed: an anonymous visitor would have nowhere to go. Install a feature with the login route or set router.login.` });
    }
  }
  for (const { feature, binding } of navigationBindings.destinations.values()) {
    const problem = unresolved(binding.to);
    if (problem) routerIssues.push({ owner: `feature "${feature}"`, message: `the destination "${binding.destination}" is bound to ${JSON.stringify(binding.to)}, which ${problem}.` });
  }
  if (routerIssues.length > 0) throw new ApplicationError(routerIssues);

  // --- 3. runtime state
  const state = shallowRef<ApplicationState>({ status: "idle" });
  const environment: ApplicationEnvironment = {
    state,
    locale: computed(() => composer.locale.value),
    locales: supportedLocales,
    setLocale: async (locale) => {
      const before = composer.locale.value;
      const committed = await messages.setLocale(locale);
      if (committed && composer.locale.value !== before) {
        const failed = (error: unknown) => report({ source: "locale", error, detail: locale });
        try {
          void Promise.resolve(options.onLocaleChange?.(locale)).catch(failed);
        } catch (error) {
          failed(error);
        }
      }
      return committed;
    },
    retry: () => retry(),
  };

  const owned: { contributions: OwnedContribution[]; effects: OwnedEffect[] } = {
    contributions: features.flatMap((feature) => feature.contributions.map((contribution) => ({ feature: feature.id, contribution }))),
    effects: features.flatMap((feature) => feature.effects.map((effect) => ({ feature: feature.id, effect }))),
  };
  const effects = createEffectRunner({
    effects: owned.effects,
    platform,
    sessionKey: options.sessionKey,
    onError: (error, effect) => report({ source: "effect", error, feature: effect.feature, detail: effect.effect.id }),
  });

  const featureNamespaces = new Map(features.map((feature) => [feature.id, feature.messages.map((entry) => entry.namespace)] as const));
  const contributionNamespaces = (scope: "always" | "authenticated") => unique(owned.contributions.filter(({ contribution }) => contribution.scope === scope).flatMap(({ contribution }) => contribution.messages ?? []));
  const alwaysNamespaces = contributionNamespaces("always");
  const authenticatedNamespaces = contributionNamespaces("authenticated");
  async function prepare(to: RouteLocationNormalized): Promise<void> {
    const needed = to.matched.flatMap((record) => [...(featureNamespaces.get(record.meta.feature ?? "") ?? []), ...(record.meta.messages ?? [])]);
    const authenticated = platform.session.state.value.status === "authenticated";
    await messages.load(unique([...needed, ...alwaysNamespaces, ...(authenticated ? authenticatedNamespaces : [])]));
  }

  // The page chrome is installed with the Vue app below; a page registers its own tab title there (a record's name).
  let pageChrome: PageChrome | null = null;
  // A title the page on screen registered (a record's name) wins over its route's. Right after a navigation that page may still be
  // the previous one, for the moment before it unmounts and the watcher below applies the right title.
  function applyTitle(to: RouteLocationNormalized): void {
    const key = to.meta.titleKey;
    const page = pageChrome?.documentTitle.value ?? (key && composer.te(key) ? composer.t(key) : null);
    const title = (options.router?.documentTitle ?? defaultDocumentTitle)(page, platform.config.appName);
    if (title !== "") document.title = title;
  }

  const navigation = createNavigation({ session: platform.session, router, i18n: composer, destinations: navigationBindings.destinations });
  const contributions = createShellContributions(owned.contributions, platform.session);
  const routeAccess = createRouteAccess({ router, access: platform.access, noAccess: options.noAccess ?? NoAccess });

  // --- 4. the Vue app: install in the documented order
  const Root = defineComponent({
    name: "ApplicationRoot",
    setup() {
      return () => {
        const current = state.value;
        if (current.status === "failed") return h(StartupFailure, { kind: current.kind, onRetry: () => void retry() });
        if (current.status !== "ready") return null;
        return h(shell?.component ?? AppRouterView);
      };
    },
  });
  const app = createApp(Root);
  installPlatform(app, platform);
  app.use(i18n);
  installFormatting(app, formatting);
  pageChrome = installPageChrome(app);
  installBottomDock(app);
  if (options.icons) installIcons(app, ...(Array.isArray(options.icons) ? options.icons : [options.icons as IconSet]));
  app.provide(applicationKey, environment);
  app.provide(navigationKey, navigation);
  app.provide(shellContributionsKey, contributions);
  app.provide(routeAccessKey, routeAccess);
  for (const feature of features) for (const { key, value } of feature.contexts) app.provide(key, value);

  // --- lifecycle: everything added at mount is undone by dispose, in reverse
  let disposed = false;
  let mounting = false;
  let rendered = false;
  let routerInstalled = false;
  const undo: (() => void)[] = [];

  function installHooks(): void {
    const previousHandler = app.config.errorHandler;
    app.config.errorHandler = (error, instance, info) => {
      report({ source: "vue", error, detail: info });
      previousHandler?.(error, instance, info);
    };
    const onRejection = (event: PromiseRejectionEvent) => report({ source: "unhandledrejection", error: event.reason });
    const onWindowError = (event: ErrorEvent) => {
      if (event.error) report({ source: "window", error: event.error }); // a failed <img> or <script> has no error
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onWindowError);
    undo.push(() => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onWindowError);
    });

    undo.push(
      installRouterGuards({
        router,
        session: platform.session,
        login,
        home,
        prepare,
        afterNavigation: applyTitle,
        progress: options.router?.progress ?? shell?.progress,
        onError: (error) => report({ source: "router", error }),
      }),
    );

    // A page that registers its tab title after it loaded (a record), or leaves: the tab follows.
    const titleScope = effectScope();
    titleScope.run(() => watch(() => pageChrome?.documentTitle.value, () => applyTitle(router.currentRoute.value)));
    undo.push(() => titleScope.stop());

    // The page's language and title follow the locale (`lang` is what screen readers and hyphenation go by).
    const scope = effectScope();
    scope.run(() =>
      watch(
        () => composer.locale.value,
        (locale) => {
          document.documentElement.lang = locale;
          applyTitle(router.currentRoute.value);
        },
        { immediate: true },
      ),
    );
    undo.push(() => scope.stop());
  }

  const fail = (kind: "session" | "messages" | "startup", error: unknown) => {
    state.value = { status: "failed", kind, error };
  };

  /** Session, essential texts, first navigation; ends in `ready` or `failed`. */
  async function start(): Promise<void> {
    state.value = { status: "starting" };

    const session = await platform.session.restore();
    if (disposed) return;
    if (session.status === "failed") return fail("session", session.error);

    const failures = await messages.loadEssential();
    if (disposed) return;
    if (failures.length > 0) return fail("messages", failures[0]!.error);

    try {
      // The router is installed after its first navigation has landed: until then the application shows nothing.
      const landed = await router.replace(router.options.history.location);
      if (disposed) return;
      if (isNavigationFailure(landed)) return fail("startup", landed);
    } catch (error) {
      if (!disposed) fail("startup", error);
      return;
    }
    if (!routerInstalled) {
      app.use(router);
      routerInstalled = true;
    }
    state.value = { status: "ready" };
    effects.start();
  }

  async function retry(): Promise<void> {
    if (disposed || state.value.status !== "failed") return;
    await messages.retry();
    await start();
  }

  return {
    app,
    router,
    i18n,
    state,
    locale: environment.locale,
    setLocale: environment.setLocale,

    async mount(target) {
      if (disposed) throw new Error("This application was disposed; create a new one with createApplication().");
      if (mounting) throw new Error("This application is already mounted.");
      mounting = true;
      installHooks();
      await start();
      if (disposed) return;
      app.mount(target);
      rendered = true;
    },

    retry,

    dispose() {
      if (disposed) return;
      disposed = true;
      effects.dispose();
      messages.dispose();
      if (rendered) app.unmount();
      for (const remove of undo.reverse()) remove();
      router.options.history.destroy(); // listeners of a history whose router was never installed
    },
  };
}

function defaultOnError(report: ApplicationErrorReport): void {
  console.error(`[vue-core] ${report.source}${report.feature ? ` (${report.feature})` : ""}${report.detail ? `: ${report.detail}` : ""}`, report.error);
}

function defaultDocumentTitle(page: string | null, appName: string | null): string {
  return [page, appName].filter((part): part is string => !!part).join(" · ");
}
