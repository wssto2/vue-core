import { render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, inject, onScopeDispose, ref, watchEffect, type App } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { ApiError } from "../client";
import { useFormat } from "../format";
import { usePlatform } from "../platform";
import {
  createTestApp,
  createTestI18n,
  createTestPlatform,
  createTestSession,
  deferred,
  fakeLoader,
  heldAccess,
  jsonResponse,
  listPage,
  mockMedia,
  routedTransport,
  scriptedTransport,
  settle,
  stubRoutes,
  withSetup,
} from "./index";

describe("createTestPlatform", () => {
  it("is signed in at once, with no request, holding the permissions it was given", () => {
    const platform = createTestPlatform({ user: { id: 7 }, permissions: ["tickets:view", "tickets:update"] });
    expect(platform.session.state.value).toMatchObject({ status: "authenticated", user: { id: 7 } });
    expect(platform.access.can("tickets:view")).toBe(true);
    expect(platform.access.canAll(["tickets:view", "tickets:update"])).toBe(true);
    expect(platform.access.can("tickets:delete")).toBe(false);
  });

  it("holds nothing by default, and a permission switched off for the tenant is not held", () => {
    expect(createTestPlatform().access.can("anything")).toBe(false);
    const platform = createTestPlatform({ permissions: ["a", "b"], unavailable: ["b"] });
    expect([platform.access.can("a"), platform.access.can("b")]).toEqual([true, false]);
  });

  it("takes how each permission is held, for scoped grants", () => {
    const platform = createTestPlatform({ permissions: { "leads:view": heldAccess("dealer", 5, "own") }, root: true });
    expect(platform.access.can("leads:view", { level: "dealer", id: 5 })).toBe(true);
    expect(platform.access.can("leads:view", { level: "dealer", id: 6 })).toBe(false);
    expect(platform.access.held("leads:view")?.qualifier).toBe("own");
    expect(platform.access.root).toBe(true);
  });

  it("has nobody signed in for `user: null`: the session answers anonymous when asked", async () => {
    const platform = createTestPlatform({ user: null });
    expect(platform.session.state.value.status).toBe("unknown");
    expect(await platform.session.restore()).toMatchObject({ status: "anonymous", reason: "none" });
  });

  it("can establish another user mid-test", () => {
    const platform = createTestPlatform();
    platform.session.establish(createTestSession({ user: { id: 2 }, permissions: ["x"] }));
    expect(platform.access.can("x")).toBe(true);
  });

  it("uses a session adapter of your own without establishing anything", async () => {
    const platform = createTestPlatform({ user: { id: 9 }, session: { load: async () => null, signOut: async () => undefined } });
    expect(platform.session.state.value.status).toBe("unknown");
    expect(await platform.session.restore()).toMatchObject({ status: "anonymous" });
  });

  it("answers requests through the transport it was given, under the API base", async () => {
    const { transport, calls } = routedTransport({ "GET /api/v1/tickets": jsonResponse(200, { success: true, data: [{ id: 1 }] }) });
    const platform = createTestPlatform({ transport, config: { apiBase: "/api/v1" } });
    const result = await platform.http.get<{ id: number }[]>("/tickets");
    expect(result.data).toEqual([{ id: 1 }]);
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual(["GET /api/v1/tickets"]);
  });

  it("fails an unexpected request instead of reaching the network, naming it", async () => {
    const platform = createTestPlatform();
    const error = await platform.http.get("/tickets").catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect(String((error as ApiError).cause ?? (error as ApiError).message)).toContain("unexpected request GET /tickets");
  });

  it("builds independent platforms", () => {
    const a = createTestPlatform({ permissions: ["x"] });
    const b = createTestPlatform();
    expect([a.access.can("x"), b.access.can("x")]).toEqual([true, false]);
    expect(a.session).not.toBe(b.session);
  });

  it("overrides fields of the bootstrap config", () => {
    expect(createTestPlatform().config).toMatchObject({ apiBase: "", locale: "en", appName: "Test app", capabilities: [] });
    expect(createTestPlatform({ config: { locale: "hr", capabilities: ["x"] } }).config).toMatchObject({ locale: "hr", capabilities: ["x"] });
  });
});

describe("fake transports", () => {
  it("scripts a sequence: one answer per call, the last repeats, every call recorded", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(503, { message: "down" }), jsonResponse(200, { ok: true }));
    const statuses = [];
    for (const method of ["GET", "POST", "GET"]) statuses.push((await transport("/x", { method })).status);
    expect(statuses).toEqual([503, 200, 200]);
    expect(calls.map((call) => call.method)).toEqual(["GET", "POST", "GET"]);
  });

  it("throws an Error answer, runs a function answer with the call, and reads a repeated body again", async () => {
    const { transport } = scriptedTransport(new Error("offline"), (call) => jsonResponse(200, { method: call.method }));
    await expect(transport("/x", {})).rejects.toThrow("offline");
    expect(await (await transport("/x", { method: "put" })).json()).toEqual({ method: "PUT" });
    const repeated = scriptedTransport(jsonResponse(200, { a: 1 })).transport;
    expect(await (await repeated("/x", {})).json()).toEqual({ a: 1 });
    expect(await (await repeated("/x", {})).json()).toEqual({ a: 1 });
  });

  it("answers by method and path, query optional; an exact query wins", async () => {
    const { transport } = routedTransport({
      "GET /tickets": jsonResponse(200, { which: "plain" }),
      "GET /tickets?page=2": jsonResponse(200, { which: "page two" }),
      "POST /tickets": (call) => jsonResponse(201, { method: call.method }),
    });
    const which = async (url: string, method = "GET") => (await (await transport(url, { method })).json()) as Record<string, string>;
    expect(await which("/tickets?sort=a")).toEqual({ which: "plain" });
    expect(await which("/tickets?page=2")).toEqual({ which: "page two" });
    expect(await which("/tickets", "POST")).toEqual({ method: "POST" });
  });

  it("fails a request no route matches, naming the routes", async () => {
    const { transport, calls } = routedTransport({ "GET /tickets": jsonResponse(200, {}) });
    await expect(transport("/orders", {})).rejects.toThrow(/no route for GET \/orders; it has GET \/tickets/);
    expect(calls).toHaveLength(1);
  });

  it("builds JSON responses; an undefined body is an empty one", async () => {
    const ok = jsonResponse(200, { a: 1 }, { "X-Request-ID": "r1" });
    expect(ok.headers.get("content-type")).toBe("application/json");
    expect(ok.headers.get("x-request-id")).toBe("r1");
    expect(jsonResponse(204).status).toBe(204);
    expect(await jsonResponse(204).text()).toBe("");
  });
});

describe("createTestI18n", () => {
  it("has the library's texts in every locale", () => {
    expect(createTestI18n().global.t("core.actions.cancel")).toBeTruthy();
    expect(createTestI18n({ locale: "hr" }).global.t("core.actions.cancel")).not.toBe(createTestI18n().global.t("core.actions.cancel"));
  });

  it("merges your texts over them, yours winning, keeping the rest of the namespace", () => {
    const i18n = createTestI18n({ messages: { en: { tickets: { title: "Tickets" }, core: { actions: { cancel: "Never mind" } } }, de: { hello: "Hallo" } } });
    expect(i18n.global.t("tickets.title")).toBe("Tickets");
    expect(i18n.global.t("core.actions.cancel")).toBe("Never mind");
    expect(i18n.global.t("core.actions.close")).toBe("Close");
    i18n.global.locale.value = "de";
    expect(i18n.global.t("hello")).toBe("Hallo");
  });
});

describe("createTestApp", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  const Probe = defineComponent({
    setup() {
      const { t } = useI18n();
      const route = useRoute();
      const { access } = usePlatform();
      const format = useFormat();
      return () => h("div", { "data-test": "probe" }, [t("tickets.title"), `|${route.path}|${String(access.can("tickets:view"))}|${format.number(1234.5)}`]);
    },
  });

  it("installs the router, the i18n with your texts, the platform and formatting around a component", async () => {
    const app = createTestApp({ platform: createTestPlatform({ permissions: ["tickets:view"] }), messages: { en: { tickets: { title: "Tickets" } } }, location: "/tickets?x=1" });
    render(Probe, { global: { plugins: [...app.plugins] } });
    await app.router.isReady();
    expect(screen.getByText("Tickets|/tickets|true|1,234.5")).toBeTruthy();
    expect(app.router.currentRoute.value.query).toEqual({ x: "1" });
  });

  it("follows the locale of the i18n in formatting", async () => {
    const app = createTestApp({ locale: "hr", messages: { hr: { tickets: { title: "Tiketi" } } } });
    render(Probe, { global: { plugins: [...app.plugins] } });
    await app.router.isReady();
    expect(screen.getByText(/^Tiketi\|\/\|false\|1\.234,5$/)).toBeTruthy();
  });

  it("matches any address by default and navigates among your routes", async () => {
    const plain = createTestApp();
    await plain.router.push("/anywhere/at/all");
    expect(plain.router.currentRoute.value.path).toBe("/anywhere/at/all");

    const Page = (text: string) => defineComponent({ render: () => h("p", text) });
    const app = createTestApp({
      routes: [
        { path: "/", name: "home", component: Page("home page") },
        { path: "/other", name: "other", component: Page("other page") },
      ],
    });
    render(defineComponent({ render: () => h("div", [h(RouterLink, { to: { name: "other" } }, () => "go"), h(RouterView)]) }), { global: { plugins: [...app.plugins] } });
    await app.router.isReady();
    expect(screen.getByText("home page")).toBeTruthy();
    expect(screen.getByRole("link", { name: "go" }).getAttribute("href")).toBe("/other");
  });

  it("installs the extra plugins last, to provide a feature's context", async () => {
    const key = Symbol("context");
    const Reader = defineComponent({ setup: () => { const value = inject<string>(key); return () => h("p", value); } });
    const app = createTestApp({ plugins: [{ install: (instance: App) => instance.provide(key, "from the plugin") }] });
    render(Reader, { global: { plugins: [...app.plugins] } });
    expect(screen.getByText("from the plugin")).toBeTruthy();
  });

  it("uses the router it is given", () => {
    const first = createTestApp();
    const second = createTestApp({ router: first.router });
    expect(second.router).toBe(first.router);
  });

  it("stubs the pages of real routes and keeps their names, meta and nesting", async () => {
    const Real = defineComponent({ render: () => h("p", "a real page") });
    const stubbed = stubRoutes([
      { path: "/tickets", name: "tickets", component: Real, meta: { access: "tickets:view" }, children: [{ path: ":id", name: "ticket", component: Real }] },
      { path: "/old", redirect: { name: "tickets" } },
    ]);
    const app = createTestApp({ routes: stubbed, location: "/old" });
    render(defineComponent({ render: () => h(RouterView) }), { global: { plugins: [...app.plugins] } });
    await app.router.isReady();
    expect(app.router.currentRoute.value.name).toBe("tickets");
    await app.router.push({ name: "ticket", params: { id: "3" } });
    expect(app.router.currentRoute.value.matched.map((record) => record.name)).toEqual(["tickets", "ticket"]);
    expect(app.router.getRoutes().find((record) => record.name === "tickets")?.meta).toEqual({ access: "tickets:view" });
    expect(screen.queryByText("a real page")).toBeNull();
  });
});

describe("withSetup", () => {
  it("runs a composable inside a component of the application, and unmounting stops what it started", () => {
    let stopped = false;
    const { result, unmount } = withSetup(() => {
      onScopeDispose(() => (stopped = true));
      return { platform: usePlatform(), t: useI18n().t("core.actions.cancel"), route: useRoute().path };
    });
    expect(result.platform.access.can("x")).toBe(false);
    expect(result.t).toBeTruthy();
    expect(result.route).toBe("/");
    unmount();
    expect(stopped).toBe(true);
  });

  it("uses the environment it is given", () => {
    const app = createTestApp({ platform: createTestPlatform({ permissions: ["x"] }) });
    expect(withSetup(() => usePlatform().access.can("x"), app).result).toBe(true);
  });

  it("lets an error of the composable through", () => {
    expect(() => withSetup(() => { throw new Error("broken"); })).toThrow("broken");
  });
});

describe("async helpers", () => {
  it("settles a promise by hand", async () => {
    const wait = deferred<number>();
    const seen = wait.promise.then((value) => value * 2);
    wait.resolve(21);
    expect(await seen).toBe(42);
    const failing = deferred<number>();
    failing.reject(new Error("no"));
    await expect(failing.promise).rejects.toThrow("no");
  });

  it("lets timers of 0 ms and the update queue run", async () => {
    const shown = ref(0);
    const rendered: number[] = [];
    withSetup(() => watchEffect(() => rendered.push(shown.value)));
    setTimeout(() => (shown.value = 1), 0);
    await settle();
    expect(rendered).toEqual([0, 1]);
  });
});

describe("collection helpers", () => {
  it("builds a page from rows, with overrides for a page of many", () => {
    expect(listPage([{ id: 1 }, { id: 2 }])).toMatchObject({ total: 2, page: 1, lastPage: 1, from: 1, to: 2 });
    expect(listPage<{ id: number }>([])).toMatchObject({ total: 0, lastPage: 0, from: 0, to: 0 });
    expect(listPage([{ id: 1 }], { total: 90, lastPage: 4 })).toMatchObject({ total: 90, lastPage: 4 });
  });

  it("records what a loader was asked and answers from the query", async () => {
    const { load, calls } = fakeLoader((query) => listPage([{ id: query.page }]));
    const query = { page: 3, pageSize: 25, sort: null, direction: "asc" as const, search: "", view: null, filters: {} };
    const result = await load(query, { signal: new AbortController().signal });
    expect(result.rows).toEqual([{ id: 3 }]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.query.page).toBe(3);
  });
});

describe("mockMedia", () => {
  it("answers the library's conditions and fires change listeners", () => {
    const media = mockMedia({ narrow: true });
    try {
      expect(window.matchMedia("(max-width: 1023px)").matches).toBe(true);
      expect(window.matchMedia("(max-width: 47.999rem)").matches).toBe(false);
      expect(window.matchMedia("(max-width: 1023px), (pointer: coarse)").matches).toBe(true);
      let fired = 0;
      window.matchMedia("(max-width: 47.999rem)").addEventListener("change", () => fired++);
      media.set({ compact: true });
      expect(fired).toBe(1);
      expect(window.matchMedia("(pointer: coarse)").matches).toBe(true);
    } finally {
      media.restore();
    }
  });
});
