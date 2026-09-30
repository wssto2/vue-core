import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { createMemoryHistory, createRouter, type RouteLocationNormalized, type RouteRecordRaw, type Router } from "vue-router";
import { createSession, type SessionAdapter, type SessionSnapshot } from "../platform";
import { snapshotOf } from "../platform/testing";
import { installRouterGuards, returnTo, type RouterGuardOptions } from "./guards";

const view = { render: () => null };
const routes: RouteRecordRaw[] = [
  { name: "login", path: "/login", component: view, meta: { public: true } },
  { name: "home", path: "/", component: view },
  { name: "tickets", path: "/tickets", component: view },
  { name: "public-parent", path: "/help", component: view, meta: { public: true }, children: [{ name: "help-article", path: "article", component: view }] },
];

function setup(initial: SessionSnapshot | null, extra: Partial<RouterGuardOptions> = {}) {
  const control = { snapshot: initial, fail: false };
  const adapter: SessionAdapter = {
    async load() {
      if (control.fail) throw new Error("down");
      return control.snapshot;
    },
    async signOut() {},
  };
  const session = createSession(adapter);
  const router: Router = createRouter({ history: createMemoryHistory(), routes });
  const remove = installRouterGuards({ router, session, login: { name: "login" }, home: { name: "home" }, ...extra });
  return { router, session, control, remove };
}

afterEach(() => vi.restoreAllMocks());

describe("protected by default", () => {
  it("sends an anonymous visitor to the login page with the page to come back to", async () => {
    const { router } = setup(null);

    await router.push("/tickets?page=2");

    expect(router.currentRoute.value.name).toBe("login");
    expect(router.currentRoute.value.query.redirect).toBe("/tickets?page=2");
  });

  it("lets a signed-in user in", async () => {
    const { router } = setup(snapshotOf(1));
    await router.push("/tickets");
    expect(router.currentRoute.value.name).toBe("tickets");
  });

  it("a route needs `meta.public` to be reachable anonymously; it is inherited by its children", async () => {
    const { router } = setup(null);

    await router.push("/login");
    expect(router.currentRoute.value.name).toBe("login");
    await router.push("/help/article");
    expect(router.currentRoute.value.name).toBe("help-article");
    await router.push("/");
    expect(router.currentRoute.value.name).toBe("login"); // a route with no meta at all is protected
  });

  it("asks the server once, however many protected navigations follow", async () => {
    const load = vi.fn(async () => snapshotOf(1));
    const session = createSession({ load, signOut: async () => {} });
    const router = createRouter({ history: createMemoryHistory(), routes });
    installRouterGuards({ router, session, login: { name: "login" }, home: { name: "home" } });

    await router.push("/tickets");
    await router.push("/");
    await router.push("/tickets");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("a server that cannot answer is not 'signed out': the navigation stops and the failure is reported", async () => {
    const onError = vi.fn();
    const { router, control } = setup(snapshotOf(1), { onError });
    control.fail = true;

    const result = await router.push("/tickets");

    expect(result).toBeTruthy(); // a navigation failure (aborted)
    expect(router.currentRoute.value.name).toBeUndefined();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(String(onError.mock.calls[0]![0])).toContain("down");
  });
});

describe("the login page", () => {
  it("a signed-in user who opens it goes to where they were heading, else home", async () => {
    const { router } = setup(snapshotOf(1));

    await router.push("/login?redirect=/tickets");
    expect(router.currentRoute.value.name).toBe("tickets");

    await router.push("/login");
    expect(router.currentRoute.value.name).toBe("home");
  });

  it("never follows a redirect that leaves the app", async () => {
    const { router } = setup(snapshotOf(1));

    for (const evil of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"]) {
      await router.push({ name: "login", query: { redirect: evil } });
      expect(router.currentRoute.value.name).toBe("home");
    }
  });

  it("returnTo reads a path of this app only", () => {
    expect(returnTo({ query: { redirect: "/a?b=1" } })).toBe("/a?b=1");
    expect(returnTo({ query: { redirect: ["/first", "/second"] } })).toBe("/first");
    expect(returnTo({ query: {} })).toBeNull();
    expect(returnTo({ query: { redirect: "http://x" } })).toBeNull();
  });
});

describe("a session that ends under an open page", () => {
  it("expiry sends the user to the login page and remembers the page", async () => {
    const { router, session } = setup(snapshotOf(1));
    await router.push("/tickets");

    session.expire();
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe("login"));

    expect(router.currentRoute.value.query.redirect).toBe("/tickets");
  });

  it("signing out goes to the login page without a page to return to", async () => {
    const { router, session } = setup(snapshotOf(1));
    await router.push("/tickets");

    await session.signOut();
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe("login"));

    expect(router.currentRoute.value.query.redirect).toBeUndefined();
  });

  it("does nothing on a public page", async () => {
    const { router, session } = setup(snapshotOf(1));
    await router.push("/help/article");

    session.expire();
    await nextTick();

    expect(router.currentRoute.value.name).toBe("help-article");
  });
});

describe("prepare, title and progress", () => {
  it("prepare starts before the view resolves and is awaited before the navigation lands", async () => {
    const events: string[] = [];
    let release!: () => void;
    const prepare = vi.fn(() => new Promise<void>((resolve) => (release = () => { events.push("prepared"); resolve(); })));
    const { router } = setup(snapshotOf(1), { prepare });

    const navigation = router.push("/tickets").then(() => events.push("landed"));
    await vi.waitFor(() => expect(prepare).toHaveBeenCalledTimes(1));
    expect(router.currentRoute.value.name).toBeUndefined(); // not landed yet
    release();
    await navigation;

    expect(events).toEqual(["prepared", "landed"]);
  });

  it("prepare is not started for a navigation that redirects to the login page", async () => {
    const prepare = vi.fn(async (_to: RouteLocationNormalized) => {});
    const { router } = setup(null, { prepare });

    await router.push("/tickets");

    expect(prepare.mock.calls.map(([to]) => to.name)).toEqual(["login"]);
  });

  it("the title follows the navigation that landed, not one that was stopped (ARV set it before the guards decided)", async () => {
    const afterNavigation = vi.fn();
    const { router } = setup(snapshotOf(1), { afterNavigation });
    router.beforeEach((to) => (to.path === "/blocked" ? false : undefined));
    router.addRoute({ name: "blocked", path: "/blocked", component: view });

    await router.push("/tickets");
    await router.push("/blocked");

    expect(afterNavigation.mock.calls.map(([to]) => to.path)).toEqual(["/tickets"]);
  });

  it("progress: one start and one done per navigation, through a redirect, a stop and a failing view", async () => {
    const progress = { start: vi.fn(), done: vi.fn() };
    const { router } = setup(null, { progress });

    await router.push("/tickets"); // redirected to the login page: two beforeEach runs, one afterEach
    expect([progress.start.mock.calls.length, progress.done.mock.calls.length]).toEqual([1, 1]);

    router.addRoute({ name: "broken", path: "/broken", meta: { public: true }, component: () => Promise.reject(new Error("chunk failed")) });
    await router.push("/broken").catch(() => {}); // ARV never hid the indicator after this
    expect([progress.start.mock.calls.length, progress.done.mock.calls.length]).toEqual([2, 2]);

    router.addRoute({ name: "stopped", path: "/stopped", meta: { public: true }, component: view });
    router.beforeEach((to) => (to.path === "/stopped" ? false : undefined));
    await router.push("/stopped");
    expect([progress.start.mock.calls.length, progress.done.mock.calls.length]).toEqual([3, 3]);
  });

  it("a router error is reported", async () => {
    const onError = vi.fn();
    const { router } = setup(null, { onError });
    router.addRoute({ name: "broken", path: "/broken", meta: { public: true }, component: () => Promise.reject(new Error("chunk failed")) });

    await router.push("/broken").catch(() => {});

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "chunk failed" }));
  });
});

describe("removing the guards", () => {
  it("leaves the router as it was: no hook and no watcher remains", async () => {
    const progress = { start: vi.fn(), done: vi.fn() };
    const { router, session, remove } = setup(snapshotOf(1), { progress });
    await router.push("/tickets");
    remove();
    progress.start.mockClear();

    await router.push("/"); // protected, and nobody is asked
    session.expire(); // nobody reacts
    await nextTick();

    expect(router.currentRoute.value.name).toBe("home");
    expect(progress.start).not.toHaveBeenCalled();
  });
});
