/* eslint-disable vue/one-component-per-file -- the helpers are small stand-in components */
import { createApp, defineComponent, h, type App, type Plugin } from "vue";
import { createMemoryHistory, createRouter, RouterView, type RouteRecordRaw, type Router } from "vue-router";
import { installPlatform, type Platform } from "../platform";
import { createTestI18n, type TestMessages } from "./i18n";
import { testFormatting } from "./format";
import { createTestPlatform } from "./platform";

const Blank = defineComponent({ name: "TestBlankPage", render: () => h("div") });
const Passthrough = defineComponent({ name: "TestRouteStub", render: () => h("div", [h(RouterView)]) });

/**
 * The route records with every page replaced by an empty stand-in (nested records still render
 * their children), keeping names, paths, meta, redirects and guards: a view under test can link to
 * and navigate among the application's real routes without loading the other pages.
 *
 *   createTestApp({ routes: stubRoutes(ticketRoutes.records) })
 */
export function stubRoutes(records: readonly RouteRecordRaw[]): RouteRecordRaw[] {
  return records.map((record) => {
    const { component, components, children, ...rest } = record as unknown as Record<string, unknown>;
    const out: Record<string, unknown> = { ...rest };
    if (children) out.children = stubRoutes(children as RouteRecordRaw[]);
    if (components) out.components = Object.fromEntries(Object.keys(components).map((name) => [name, Passthrough]));
    else if (component !== undefined) out.component = Passthrough;
    return out as unknown as RouteRecordRaw;
  });
}

export interface TestAppOptions {
  /** Default: `createTestPlatform()`, a signed-in user holding nothing. */
  platform?: Platform;
  /** The routes; default: one that matches every address with an empty page. */
  routes?: readonly RouteRecordRaw[];
  /** Where the router starts, query included; default `/`. */
  location?: string;
  /** Use this router instead of making one (`routes` and `location` are then not used). */
  router?: Router;
  /** Default `en`. */
  locale?: string;
  /** Your texts per locale, over the library's. */
  messages?: TestMessages;
  /** More plugins, installed last: provide a feature's context here (`{ install: (app) => app.provide(key, value) }`). */
  plugins?: readonly Plugin[];
}

/** What a component needs around it to run as it does in the application. */
export interface TestApp {
  /** For `render(Component, { global: { plugins: app.plugins } })` of @testing-library/vue, `mount` of @vue/test-utils, or `withSetup`. */
  readonly plugins: readonly Plugin[];
  readonly platform: Platform;
  readonly router: Router;
  readonly i18n: ReturnType<typeof createTestI18n>;
}

/**
 * The application's environment for a test: the platform, a memory-history router, vue-i18n with
 * the library's texts and your own, and formatting that follows the locale. The router starts
 * navigating to `location` when it is installed: `await app.router.isReady()` before asserting on
 * what a route renders (or `await app.router.push(...)` to go elsewhere).
 *
 *   const app = createTestApp({ platform: createTestPlatform({ permissions: ["tickets:view"] }), location: "/tickets" });
 *   render(TicketList, { global: { plugins: app.plugins } });
 *   await app.router.isReady();
 */
export function createTestApp(options: TestAppOptions = {}): TestApp {
  const platform = options.platform ?? createTestPlatform();
  let router = options.router;
  if (!router) {
    const history = createMemoryHistory();
    history.replace(options.location ?? "/");
    router = createRouter({ history, routes: [...(options.routes ?? [{ path: "/:pathMatch(.*)*", component: Blank }])] });
  }
  const i18n = createTestI18n({ locale: options.locale, messages: options.messages });
  const plugins: Plugin[] = [router, i18n, testFormatting(i18n), { install: (app) => installPlatform(app, platform) }, ...(options.plugins ?? [])];
  return { plugins, platform, router, i18n };
}

/**
 * Runs a composable inside a mounted component of an application (`environment`: a `createTestApp()`
 * by default, or just `{ plugins }`), as it is used: injections, the router and `onScopeDispose`
 * work. Unmount to stop what it started.
 *
 *   const { result, unmount } = withSetup(() => useCollection(definition, { state: { kind: "memory" } }));
 */
export function withSetup<T>(setup: () => T, environment: { readonly plugins: readonly Plugin[] } = createTestApp()): { result: T; app: App; unmount: () => void } {
  let result!: T;
  const app = createApp(
    defineComponent({
      setup() {
        result = setup();
        return () => h("div");
      },
    }),
  );
  for (const plugin of environment.plugins) app.use(plugin);
  app.mount(document.createElement("div"));
  return { result, app, unmount: () => app.unmount() };
}
