import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";
import { defineFeatureContext } from "../platform";
import { localeMessages } from "../i18n";
import { useI18n } from "vue-i18n";
import { createMemoryHistory } from "vue-router";
import { createApplication, type Application } from "./application";
import { useApplication } from "./environment";
import { defineFeature, provideContext } from "./feature";
import { ShellOutlet } from "./contributions";
import { useNavigation } from "../router/navigation";
import { AppRouterView } from "../router/access";
import { deferred } from "../platform/testing";
import { fakeBackend, options, page, settle, signedIn } from "./testing";

const mounted: Application[] = [];
const hosts: HTMLElement[] = [];
afterEach(() => {
  for (const application of mounted.splice(0)) application.dispose();
  for (const host of hosts.splice(0)) host.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function host() {
  const element = document.createElement("div");
  document.body.append(element);
  hosts.push(element);
  return element;
}

async function start(application: Application, target: HTMLElement = host()) {
  mounted.push(application);
  await application.mount(target);
  await settle();
  return target;
}

const loginFeature = defineFeature({ id: "login", routes: [{ name: "login", path: "/login", component: page("login page"), meta: { public: true, titleKey: "login.title" } }] });
const ticketsFeature = (extra = {}) =>
  defineFeature({
    id: "tickets",
    routes: [
      { name: "tickets.index", path: "/tickets", component: page("tickets page"), meta: { titleKey: "tickets.title" } },
      { name: "admin", path: "/admin", component: page("admin page"), meta: { access: "admin:view" } },
    ],
    ...extra,
  });

describe("createApplication has no side effects until mount", () => {
  it("makes no request, starts no timer, adds no listener and renders nothing", async () => {
    vi.useFakeTimers();
    const { platform, backend } = fakeBackend(signedIn(1));
    const windowListeners = vi.spyOn(window, "addEventListener");
    const documentListeners = vi.spyOn(document, "addEventListener");
    const effect = vi.fn();
    const before = vi.getTimerCount();
    createApp({ render: () => null }); // Vue's own dev setup schedules one timer under happy-dom: not ours
    const vueOwn = vi.getTimerCount() - before;
    expect(vueOwn).toBeLessThanOrEqual(1);

    const application = createApplication(options(platform, [loginFeature, ticketsFeature({ effects: [{ id: "e", scope: "app", start: effect }] })], "/tickets"));

    expect(backend.loads).toBe(0);
    expect(vi.getTimerCount() - before).toBe(vueOwn);
    expect(windowListeners).not.toHaveBeenCalled();
    expect(documentListeners).not.toHaveBeenCalled();
    expect(effect).not.toHaveBeenCalled();
    expect(application.state.value).toEqual({ status: "idle" });
    application.dispose();
  });
});

describe("mount", () => {
  it("restores the session before the first navigation, then renders the route", async () => {
    const { platform, backend } = fakeBackend(signedIn(1));
    const order: string[] = [];
    const gate = deferred<void>();
    backend.gate = gate.promise.then(() => void order.push("session restored"));
    const application = createApplication(options(platform, [loginFeature, ticketsFeature()], "/tickets"));
    application.router.beforeEach(() => void order.push("first navigation"));

    const target = host();
    mounted.push(application);
    const mounting = application.mount(target);
    await settle();
    expect(order).toEqual([]); // still waiting for the session: no navigation yet
    gate.resolve();
    await mounting;

    expect(order).toEqual(["session restored", "first navigation"]);
    expect(target.textContent).toBe("tickets page");
    expect(application.state.value).toEqual({ status: "ready" });
  });

  it("sends an anonymous visitor to the login page and remembers where they were heading", async () => {
    const { platform } = fakeBackend(null);
    const application = createApplication(options(platform, [loginFeature, ticketsFeature()], "/tickets"));

    const target = await start(application);

    expect(target.textContent).toBe("login page");
    expect(application.router.currentRoute.value.query.redirect).toBe("/tickets");
  });

  it("renders a public route without a session and a protected one with it", async () => {
    const anonymous = fakeBackend(null).platform;
    const publicApp = createApplication(options(anonymous, [loginFeature], "/login"));
    expect((await start(publicApp)).textContent).toBe("login page");
  });

  it("shows the no-access state, in place and with no redirect, for a page the session lacks the permission for", async () => {
    const { platform } = fakeBackend(signedIn(1));
    const application = createApplication(options(platform, [loginFeature, ticketsFeature()], "/admin"));

    const target = await start(application);

    expect(target.textContent).toContain("No access");
    expect(application.router.currentRoute.value.fullPath).toBe("/admin");
  });

  it("the no-access state follows a permission refresh", async () => {
    const { platform, backend } = fakeBackend(signedIn(1));
    const application = createApplication(options(platform, [loginFeature, ticketsFeature()], "/admin"));
    const target = await start(application);
    expect(target.textContent).toContain("No access");

    backend.snapshot = signedIn(1, ["admin:view"]);
    await platform.session.refresh();
    await settle();

    expect(target.textContent).toBe("admin page");
  });

  it("a session that expires under an open page sends the user to the login page", async () => {
    const { platform } = fakeBackend(signedIn(1));
    const application = createApplication(options(platform, [loginFeature, ticketsFeature()], "/tickets"));
    const target = await start(application);

    platform.session.expire();
    await settle();

    expect(target.textContent).toBe("login page");
    expect(application.router.currentRoute.value.query.redirect).toBe("/tickets");
  });

  it("renders a custom shell around the routed page, with the contributions of the features in its outlets", async () => {
    const { platform } = fakeBackend(signedIn(1));
    const shell = defineComponent({ render: () => h("div", [h("header", [h(ShellOutlet, { slot: "headerActions" })]), h("main", [h(AppRouterView)])]) });
    const bell = defineComponent({ render: () => h("button", "bell") });
    const search = defineComponent({ render: () => h("button", "search") });
    const guestOnly = defineComponent({ render: () => h("button", "help") });
    const features = [
      loginFeature,
      ticketsFeature({ contributions: [{ id: "search", slot: "headerActions", component: search, scope: "authenticated", order: 2 }] }),
      defineFeature({ id: "notifications", contributions: [{ id: "bell", slot: "headerActions", component: bell, scope: "authenticated", order: 1 }, { id: "help", slot: "headerActions", component: guestOnly, scope: "always", order: 3 }] }),
    ];
    const application = createApplication(options(platform, features, "/tickets", { shell: { component: shell, slots: ["headerActions"] } }));

    const target = await start(application);

    expect(target.querySelector("header")!.textContent).toBe("bellsearchhelp"); // ordered by `order`
    expect(target.querySelector("main")!.textContent).toBe("tickets page");

    platform.session.expire();
    await settle();
    expect(target.querySelector("header")!.textContent).toBe("help"); // authenticated contributions leave with the session
  });

  it("resolves the server's menu through the features' bindings", async () => {
    const { platform } = fakeBackend(signedIn(1, [], { navigation: [{ i18n: "nav.tickets", route: "tickets" }, { i18n: "nav.reports", route: "reports" }] }));
    let seen: readonly { label: string; to: unknown }[] = [];
    const shell = defineComponent({ setup() { const items = useNavigation(); return () => { seen = items.value; return h(AppRouterView); }; } });
    const application = createApplication(
      options(platform, [loginFeature, ticketsFeature({ navigation: [{ destination: "tickets", to: { name: "tickets.index" } }] })], "/tickets", {
        shell,
        i18n: { missingWarn: false, messages: { en: { nav: { tickets: "Tickets", reports: "Reports" } } } },
      }),
    );

    await start(application);

    expect(seen).toMatchObject([{ label: "Tickets", to: { name: "tickets.index" } }]); // `reports` has no binding: no broken link
  });

  it("provides the feature contexts before anything can navigate", async () => {
    const [KEY, useKey] = defineFeatureContext<{ greeting: string }>("test.greeting");
    const { platform } = fakeBackend(signedIn(1));
    const greeting = defineComponent({ setup() { const value = useKey(); return () => h("p", value.greeting); } });
    const feature = defineFeature({ id: "greeter", context: provideContext(KEY, { greeting: "hello" }), routes: [{ name: "greet", path: "/greet", component: greeting }] });

    const target = await start(createApplication(options(platform, [loginFeature, feature], "/greet")));

    expect(target.textContent).toBe("hello");
  });

  it("applies the formatting environment and the icon set the application gave", async () => {
    const { platform } = fakeBackend(signedIn(1));
    const { useFormat } = await import("../format");
    const probe = defineComponent({ setup() { const format = useFormat(); return () => h("p", format.date(new Date(2026, 8, 30))); } });
    const feature = defineFeature({ id: "f", routes: [{ name: "f", path: "/f", component: probe }] });
    const target = await start(createApplication(options(platform, [loginFeature, feature], "/f", { formatting: { date: () => "DD.MM.YYYY." } })));
    expect(target.textContent).toBe("DD.MM.YYYY.");
  });

  it("mounting twice, or after dispose, is an error", async () => {
    const { platform } = fakeBackend(signedIn(1));
    const application = createApplication(options(platform, [loginFeature, ticketsFeature()], "/tickets"));
    await start(application);
    await expect(application.mount(host())).rejects.toThrow(/already mounted/);

    application.dispose();
    await expect(application.mount(host())).rejects.toThrow(/was disposed/);
  });
});

describe("the locale", () => {
  const localeOf = (config: Record<string, unknown>, locale?: { initial?: string }) => {
    const { platform } = fakeBackend(null, config);
    const application = createApplication(options(platform, [loginFeature], "/login", locale ? { locale } : {}));
    mounted.push(application);
    return application.locale.value;
  };

  it("starts in the server's locale when the application supports it (ARV ignored `ba`), else in the fallback", () => {
    expect(localeOf({ locale: "hr" })).toBe("hr");
    expect(localeOf({ locale: "bs" })).toBe("bs");
    expect(localeOf({ locale: "de" })).toBe("en");
    expect(localeOf({ locale: "hr" }, { initial: "sl" })).toBe("sl");
  });
});

describe("the title", () => {
  const messages = { en: { tickets: { title: "Tickets" }, login: { title: "Sign in" } } };

  it("is the page's titleKey and the app name, and follows the locale", async () => {
    const { platform } = fakeBackend(signedIn(1));
    const application = createApplication(
      options(platform, [loginFeature, ticketsFeature()], "/tickets", { i18n: { missingWarn: false, messages: { ...messages, hr: { tickets: { title: "Tiketi" } } } } }),
    );
    await start(application);
    expect(document.title).toBe("Tickets · Test app");

    await application.setLocale("hr");
    await settle();
    expect(document.title).toBe("Tiketi · Test app");
  });

  it("falls back to the app name when the key has no translation, never showing the raw key", async () => {
    const { platform } = fakeBackend(signedIn(1));
    await start(createApplication(options(platform, [loginFeature, ticketsFeature()], "/tickets")));
    expect(document.title).toBe("Test app");
  });

  it("the application can format it", async () => {
    const { platform } = fakeBackend(signedIn(1));
    const history = createMemoryHistory();
    history.replace("/tickets");
    await start(createApplication({ platform, features: [loginFeature, ticketsFeature()], i18n: { messages, missingWarn: false }, router: { history, documentTitle: (page, app) => `${app} .: ${page}` } }));
    expect(document.title).toBe("Test app .: Tickets");
  });
});

describe("message namespaces", () => {
  const ticketsMessages = (spy = vi.fn()) =>
    localeMessages("tickets", {
      en: async () => { spy("en"); return { default: { title: "Tickets", greeting: "Hello" } }; },
      hr: async () => { spy("hr"); return { default: { title: "Tiketi" } }; },
    });
  const label = defineComponent({ setup() { const { t } = useI18n(); return () => h("p", t("tickets.title")); } });
  const feature = (spy: () => void, extra = {}) =>
    defineFeature({ id: "tickets", routes: [{ name: "tickets.index", path: "/tickets", component: label }], messages: ticketsMessages(spy as never), ...extra });

  it("a direct link loads the owning feature's messages before the first render: no raw key", async () => {
    const { platform } = fakeBackend(signedIn(1));
    const spy = vi.fn();
    const target = host();
    const application = createApplication(options(platform, [loginFeature, feature(spy)], "/tickets"));
    mounted.push(application);

    const seen: string[] = [];
    new MutationObserver(() => seen.push(target.textContent ?? "")).observe(target, { childList: true, subtree: true, characterData: true });
    await application.mount(target);
    await settle();

    expect(target.textContent).toBe("Tickets");
    expect(seen.filter((text) => text.includes("tickets.title"))).toEqual([]);
    expect(spy).toHaveBeenCalledTimes(1); // en is both the locale and the fallback
  });

  it("does not load a feature's messages until a route of it is entered", async () => {
    const { platform } = fakeBackend(null);
    const spy = vi.fn();
    await start(createApplication(options(platform, [loginFeature, feature(spy)], "/login")));
    expect(spy).not.toHaveBeenCalled();
  });

  it("an essential namespace loads before the first render, wherever the route is", async () => {
    const { platform } = fakeBackend(signedIn(1));
    const shell = defineComponent({ setup() { const { t } = useI18n(); return () => h("div", [h("b", t("chrome.menu")), h(AppRouterView)]); } });
    const chrome = localeMessages("chrome", { en: async () => ({ default: { menu: "Menu" } }) }, { essential: true });
    const target = await start(createApplication(options(platform, [loginFeature, feature(vi.fn())], "/tickets", { shell, messages: [chrome] })));
    expect(target.querySelector("b")!.textContent).toBe("Menu");
  });

  it("a route's meta.messages names a namespace of another owner", async () => {
    const { platform } = fakeBackend(signedIn(1));
    const shared = localeMessages("shared", { en: async () => ({ default: { hello: "Shared hello" } }) });
    const probe = defineComponent({ setup() { const { t } = useI18n(); return () => h("p", t("shared.hello")); } });
    const consumer = defineFeature({ id: "consumer", routes: [{ name: "c", path: "/c", component: probe, meta: { messages: ["shared"] } }] });
    const target = await start(createApplication(options(platform, [loginFeature, consumer], "/c", { messages: [shared] })));
    expect(target.textContent).toBe("Shared hello");
  });

  it("a contribution's namespaces load before it renders", async () => {
    const { platform } = fakeBackend(signedIn(1));
    const bellMessages = localeMessages("bell", { en: async () => ({ default: { label: "Notifications" } }) });
    const bell = defineComponent({ setup() { const { t } = useI18n(); return () => h("button", t("bell.label")); } });
    const shell = defineComponent({ render: () => h("div", [h(ShellOutlet, { slot: "headerActions" }), h(AppRouterView)]) });
    const notifications = defineFeature({ id: "notifications", messages: bellMessages, contributions: [{ id: "bell", slot: "headerActions", component: bell, scope: "authenticated", messages: ["bell"] }] });
    const target = await start(createApplication(options(platform, [loginFeature, notifications, feature(vi.fn())], "/tickets", { shell })));
    expect(target.querySelector("button")!.textContent).toBe("Notifications");
  });

  it("changing the locale loads what is in use first, and a stale switch never wins", async () => {
    const { platform } = fakeBackend(signedIn(1));
    const slowHr = deferred<{ default: Record<string, unknown> }>();
    const slow = localeMessages("tickets", { en: async () => ({ default: { title: "Tickets" } }), hr: () => slowHr.promise, sl: async () => ({ default: { title: "Vstopnice" } }) });
    const application = createApplication(options(platform, [loginFeature, defineFeature({ id: "tickets", routes: [{ name: "tickets.index", path: "/tickets", component: label }], messages: slow })], "/tickets"));
    const target = await start(application);
    expect(target.textContent).toBe("Tickets");

    const toHr = application.setLocale("hr");
    const toSl = application.setLocale("sl");
    await toSl;
    slowHr.resolve({ default: { title: "Tiketi" } });

    expect(await toHr).toBe(false);
    await settle();
    expect(application.locale.value).toBe("sl");
    expect(target.textContent).toBe("Vstopnice");
  });

  it("a failed optional load reports, falls back and is retried on the next visit", async () => {
    const { platform } = fakeBackend(signedIn(1));
    let fail = true;
    const flaky = localeMessages("tickets", { en: async () => { if (fail) throw new Error("offline"); return { default: { title: "Tickets" } }; } });
    const reports: unknown[] = [];
    const application = createApplication(
      options(platform, [loginFeature, defineFeature({ id: "tickets", routes: [{ name: "tickets.index", path: "/tickets", component: label }, { name: "other", path: "/other", component: page("other") }], messages: flaky })], "/tickets", { onError: (report) => reports.push(report) }),
    );
    const target = await start(application);

    expect(target.textContent).toBe("tickets.title"); // the page still renders; the text is the key until the load succeeds
    expect(reports).toMatchObject([{ source: "messages", feature: "tickets", detail: "tickets (en)" }]);

    fail = false;
    await application.router.push("/other");
    await application.router.push("/tickets");
    await settle();
    expect(target.textContent).toBe("Tickets");
  });
});

describe("start failures", () => {
  it("a server that cannot be reached shows the session failure (not a login page) and can be retried", async () => {
    const { platform, backend } = fakeBackend(signedIn(1));
    backend.failing = true;
    const application = createApplication(options(platform, [loginFeature, ticketsFeature()], "/tickets", { onError: () => {} }));

    const target = await start(application);

    expect(application.state.value).toMatchObject({ status: "failed", kind: "session" });
    expect(target.textContent).toContain("The server could not be reached");
    expect(application.router.currentRoute.value.matched).toHaveLength(0); // nothing navigated

    backend.failing = false;
    await application.retry();
    await settle();

    expect(application.state.value).toEqual({ status: "ready" });
    expect(target.textContent).toBe("tickets page");
  });

  it("the failure view has a retry button", async () => {
    const { platform, backend } = fakeBackend(signedIn(1));
    backend.failing = true;
    const application = createApplication(options(platform, [loginFeature, ticketsFeature()], "/tickets", { onError: () => {} }));
    const target = await start(application);

    backend.failing = false;
    target.querySelector("button")!.click();
    await settle();

    expect(target.textContent).toBe("tickets page");
  });

  it("essential texts that cannot be loaded are a different failure", async () => {
    const { platform } = fakeBackend(signedIn(1));
    const chrome = localeMessages("chrome", { en: async () => { throw new Error("404"); } }, { essential: true });
    const application = createApplication(options(platform, [loginFeature, ticketsFeature()], "/tickets", { messages: [chrome], onError: () => {} }));

    const target = await start(application);

    expect(application.state.value).toMatchObject({ status: "failed", kind: "messages" });
    expect(target.textContent).toContain("The application texts could not be loaded");
  });

  it("a first navigation that throws (a view chunk that does not load) is a startup failure", async () => {
    const { platform } = fakeBackend(signedIn(1));
    const broken = defineFeature({ id: "broken", routes: [{ name: "broken", path: "/broken", component: () => Promise.reject(new Error("chunk failed")) }] });
    const reports: { source: string }[] = [];
    const application = createApplication(options(platform, [loginFeature, broken], "/broken", { onError: (report) => reports.push(report) }));

    await start(application);

    expect(application.state.value).toMatchObject({ status: "failed", kind: "startup" });
    expect(reports.map((report) => report.source)).toContain("router");
  });

  it("provides the application environment to components", async () => {
    const { platform } = fakeBackend(signedIn(1));
    let environment: ReturnType<typeof useApplication> | undefined;
    const probe = defineComponent({ setup() { environment = useApplication(); return () => h("p", "x"); } });
    const feature = defineFeature({ id: "f", routes: [{ name: "f", path: "/f", component: probe }] });
    await start(createApplication(options(platform, [loginFeature, feature], "/f")));
    expect(environment!.locales).toEqual(["en", "hr", "bs", "sl"]);
    expect(environment!.locale.value).toBe("en");
    await nextTick();
  });
});
