import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { createApplication, type Application } from "./application";
import { defineFeature } from "./feature";
import type { AppEffect, AppEffectContext, SessionEffect, SessionEffectContext } from "./feature";
import { deferred } from "../platform/testing";
import { fakeBackend, options, page, settle, signedIn } from "./testing";

const apps: Application[] = [];
const hosts: HTMLElement[] = [];
afterEach(() => {
  for (const application of apps.splice(0)) application.dispose();
  for (const element of hosts.splice(0)) element.remove();
  vi.restoreAllMocks();
});

const host = () => {
  const element = document.createElement("div");
  document.body.append(element);
  hosts.push(element);
  return element;
};
async function start(application: Application, target = host()) {
  apps.push(application);
  await application.mount(target);
  await settle();
  return target;
}

const login = defineFeature({ id: "login", routes: [{ name: "login", path: "/login", component: page("login"), meta: { public: true } }] });
const home = defineFeature({ id: "home", routes: [{ name: "home", path: "/home", component: page("home") }] });

/** An effect that records its life: started with which user, stopped, and whether its signal was aborted by then. */
function recording(id: string, scope: "app" | "session", log: string[]): AppEffect | SessionEffect {
  const start = (context: AppEffectContext | SessionEffectContext) => {
    log.push(`start ${id}${"user" in context ? ` user ${String(context.user.id)}` : ""}`);
    return () => void log.push(`stop ${id} aborted=${context.signal.aborted}`);
  };
  return { id, scope, start } as AppEffect | SessionEffect;
}

describe("app effects", () => {
  it("start once when the application is ready and stop on dispose, with their signal aborted first", async () => {
    const log: string[] = [];
    const { platform } = fakeBackend(signedIn(1));
    const application = createApplication(options(platform, [login, home, defineFeature({ id: "x", effects: [recording("tick", "app", log)] })], "/home"));

    await start(application);
    expect(log).toEqual(["start tick"]);

    application.dispose();
    expect(log).toEqual(["start tick", "stop tick aborted=true"]);
    application.dispose(); // idempotent
    expect(log).toHaveLength(2);
  });

  it("do not start before the session and the first navigation are there, and once after a failed start is retried", async () => {
    const log: string[] = [];
    const { platform, backend } = fakeBackend(signedIn(1));
    backend.failing = true;
    const application = createApplication(options(platform, [login, home, defineFeature({ id: "x", effects: [recording("tick", "app", log)] })], "/home", { onError: () => {} }));

    await start(application);
    expect(log).toEqual([]); // failed start: nothing runs

    backend.failing = false;
    await application.retry();
    await application.retry(); // a second retry while ready does nothing
    expect(log).toEqual(["start tick"]);
  });

  it("a feature that is not in the list runs nothing", async () => {
    const log: string[] = [];
    const absent = defineFeature({ id: "absent", effects: [recording("never", "app", log)], routes: [{ name: "absent", path: "/absent", component: page("a") }] });
    const { platform } = fakeBackend(signedIn(1));
    await start(createApplication(options(platform, [login, home], "/home")));
    expect(absent.effects).toHaveLength(1);
    expect(log).toEqual([]);
  });

  it("stop in the reverse order of starting", async () => {
    const log: string[] = [];
    const { platform } = fakeBackend(signedIn(1));
    const application = createApplication(
      options(platform, [login, home, defineFeature({ id: "one", effects: [recording("a", "app", log), recording("b", "app", log)] }), defineFeature({ id: "two", effects: [recording("c", "app", log)] })], "/home"),
    );
    await start(application);
    log.length = 0;

    application.dispose();

    expect(log.map((line) => line.split(" ")[1])).toEqual(["c", "b", "a"]);
  });

  it("a throwing start is reported with its feature and id, and does not stop the others; a throwing stop is reported too", async () => {
    const log: string[] = [];
    const reports: { source: string; feature?: string; detail?: string }[] = [];
    const { platform } = fakeBackend(signedIn(1));
    const broken: AppEffect = { id: "broken", scope: "app", start: () => { throw new Error("start failed"); } };
    const leaky: AppEffect = { id: "leaky", scope: "app", start: () => () => { throw new Error("stop failed"); } };
    const application = createApplication(
      options(platform, [login, home, defineFeature({ id: "x", effects: [broken, leaky, recording("fine", "app", log)] })], "/home", { onError: (report) => reports.push(report) }),
    );

    await start(application);
    expect(log).toEqual(["start fine"]);
    application.dispose();

    expect(reports).toMatchObject([
      { source: "effect", feature: "x", detail: "broken" },
      { source: "effect", feature: "x", detail: "leaky" },
    ]);
    expect(log).toContain("stop fine aborted=true");
  });
});

describe("session effects", () => {
  it("run while someone is signed in: started with the user, stopped on sign-out, started again for the next user", async () => {
    const log: string[] = [];
    const { platform } = fakeBackend(signedIn(1));
    const application = createApplication(options(platform, [login, home, defineFeature({ id: "x", effects: [recording("watch", "session", log)] })], "/home"));
    await start(application);
    expect(log).toEqual(["start watch user 1"]);

    await platform.session.signOut();
    expect(log).toEqual(["start watch user 1", "stop watch aborted=true"]); // cancelled at once, before anything else reacts

    platform.session.establish(signedIn(2));
    expect(log).toEqual(["start watch user 1", "stop watch aborted=true", "start watch user 2"]);

    application.dispose();
    expect(log.at(-1)).toBe("stop watch aborted=true");
  });

  it("are not started for a visitor with no session, and start when one is established", async () => {
    const log: string[] = [];
    const { platform } = fakeBackend(null);
    await start(createApplication(options(platform, [login, home, defineFeature({ id: "x", effects: [recording("watch", "session", log)] })], "/login")));
    expect(log).toEqual([]);

    platform.session.establish(signedIn(5));
    expect(log).toEqual(["start watch user 5"]);
  });

  it("run once per session: a refresh of the same user (a policy refresh) does not restart them", async () => {
    const log: string[] = [];
    const { platform, backend } = fakeBackend(signedIn(1));
    await start(createApplication(options(platform, [login, home, defineFeature({ id: "x", effects: [recording("watch", "session", log)] })], "/home")));

    backend.snapshot = signedIn(1, ["new:permission"]);
    await platform.session.refresh();

    expect(log).toEqual(["start watch user 1"]);
  });

  it("restart when the session's scope changes, as the application defines it", async () => {
    const log: string[] = [];
    const { platform, backend } = fakeBackend(signedIn(1, [], { expiresAt: new Date(1) }));
    await start(
      createApplication(
        options(platform, [login, home, defineFeature({ id: "x", effects: [recording("watch", "session", log)] })], "/home", {
          sessionKey: (session) => `${String(session.user.id)}@${session.expiresAt?.getTime()}`, // a stand-in for "the active tenant"
        }),
      ),
    );

    backend.snapshot = signedIn(1, [], { expiresAt: new Date(2) });
    await platform.session.refresh();

    expect(log).toEqual(["start watch user 1", "stop watch aborted=true", "start watch user 1"]);
  });

  it("a late answer after sign-out is dropped: the effect sees its signal aborted and the session stays signed out", async () => {
    const answer = deferred<void>();
    const seen: { aborted: boolean }[] = [];
    const { platform, backend } = fakeBackend(signedIn(1));
    const effect: SessionEffect = {
      id: "refresher",
      scope: "session",
      start({ signal, platform: inner }) {
        void (async () => {
          await answer.promise; // a slow request of the old session
          seen.push({ aborted: signal.aborted });
          if (!signal.aborted) await inner.session.refresh();
        })();
      },
    };
    await start(createApplication(options(platform, [login, home, defineFeature({ id: "x", effects: [effect] })], "/home")));

    await platform.session.signOut();
    backend.snapshot = signedIn(1); // the server would still say "signed in" to a late request
    answer.resolve();
    await settle();

    expect(seen).toEqual([{ aborted: true }]);
    expect(platform.session.state.value).toMatchObject({ status: "anonymous", reason: "signedOut" });
  });
});

describe("two applications in one page", () => {
  it("share no user state: each has its own session, router, effects and rendered page", async () => {
    const logA: string[] = [];
    const logB: string[] = [];
    const a = fakeBackend(signedIn(1));
    const b = fakeBackend(signedIn(2));
    const shared = (log: string[]) => defineFeature({ id: "x", routes: [{ name: "home", path: "/home", component: defineComponent({ render: () => h("p", "home") }) }], effects: [recording("watch", "session", log)] });

    const appA = createApplication(options(a.platform, [login, shared(logA)], "/home"));
    const appB = createApplication(options(b.platform, [login, shared(logB)], "/home"));
    const hostA = await start(appA);
    const hostB = await start(appB);

    expect(hostA.textContent).toBe("home");
    expect(hostB.textContent).toBe("home");
    expect(appA.router).not.toBe(appB.router);
    expect([logA, logB]).toEqual([["start watch user 1"], ["start watch user 2"]]);

    await a.platform.session.signOut(); // only A is affected
    await settle();
    expect(hostA.textContent).toBe("login"); // A's user was signed out: A went to its login page
    expect(hostB.textContent).toBe("home");
    expect(logB).toEqual(["start watch user 2"]);

    appA.dispose();
    expect(hostB.textContent).toBe("home");
    expect(b.platform.session.state.value.status).toBe("authenticated");
  });

  it("the same feature value can be installed in both", () => {
    const feature = defineFeature({ id: "x", routes: [{ name: "home", path: "/home", component: page("h"), meta: { public: true } }] });
    const first = createApplication(options(fakeBackend().platform, [feature]));
    const second = createApplication(options(fakeBackend().platform, [feature]));

    expect(first.router.hasRoute("home") && second.router.hasRoute("home")).toBe(true);
    expect(feature.routes[0]!.meta).toEqual({ public: true }); // the declaration was not written to
    first.dispose();
    second.dispose();
  });
});

describe("repeated mount and dispose", () => {
  it("leaves no listener, hook, effect or rendered page behind", async () => {
    const add = { window: vi.spyOn(window, "addEventListener"), document: vi.spyOn(document, "addEventListener") };
    const remove = { window: vi.spyOn(window, "removeEventListener"), document: vi.spyOn(document, "removeEventListener") };
    const started = vi.fn();
    const stopped = vi.fn();
    const effect: AppEffect = { id: "e", scope: "app", start: () => { started(); return stopped; } };
    const progress = { start: vi.fn(), done: vi.fn() };
    const { platform } = fakeBackend(signedIn(1));
    const feature = defineFeature({ id: "x", routes: [{ name: "home", path: "/home", component: page("home") }], effects: [effect] });

    for (let round = 0; round < 5; round++) {
      const base = options(platform, [login, feature], "/home");
      const application = createApplication({ ...base, router: { ...base.router, progress } });
      const target = document.createElement("div");
      await application.mount(target);
      expect(target.textContent).toBe("home");
      application.dispose();
      expect(target.textContent).toBe("");
      progress.start.mockClear();
      await application.router.push("/login").catch(() => {}); // a hook that outlived dispose would call progress
      expect(progress.start).not.toHaveBeenCalled();
    }

    expect(started).toHaveBeenCalledTimes(5);
    expect(stopped).toHaveBeenCalledTimes(5);
    const balance = (spy: ReturnType<typeof vi.spyOn>, other: ReturnType<typeof vi.spyOn>) => {
      const added = spy.mock.calls.map((call) => String(call[0]));
      const removed = other.mock.calls.map((call) => String(call[0]));
      for (const type of new Set(added)) {
        // popstate and the like are the history's, removed by history.destroy(); every listener type the application added is removed as often.
        expect(removed.filter((name) => name === type).length, `listeners of "${type}"`).toBeGreaterThanOrEqual(added.filter((name) => name === type).length);
      }
    };
    expect(add.window.mock.calls.map((call) => call[0])).toEqual(expect.arrayContaining(["error", "unhandledrejection"])); // the check is not vacuous
    balance(add.window, remove.window);
    balance(add.document, remove.document);
  });

  it("the default web history's listeners are removed by dispose too", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { platform } = fakeBackend(signedIn(1));

    // No `router.history`: the router gets the default web history, which registers popstate when it is created.
    const application = createApplication({ platform, features: [login], i18n: { missingWarn: false } });
    expect(add.mock.calls.map((call) => call[0])).toContain("popstate");
    application.dispose();

    expect(remove.mock.calls.map((call) => call[0])).toContain("popstate");
  });

  it("dispose during mount never mounts and never starts an effect", async () => {
    const gate = deferred<void>();
    const started = vi.fn();
    const { platform, backend } = fakeBackend(signedIn(1));
    backend.gate = gate.promise;
    const feature = defineFeature({ id: "x", routes: [{ name: "home", path: "/home", component: page("home") }], effects: [{ id: "e", scope: "app", start: started }] });
    const application = createApplication(options(platform, [login, feature], "/home"));
    const target = host();

    const mounting = application.mount(target);
    application.dispose();
    gate.resolve();
    await mounting;
    await settle();

    expect(target.textContent).toBe("");
    expect(started).not.toHaveBeenCalled();
  });
});

describe("errors", () => {
  it("reports component errors, unhandled rejections and uncaught errors, and stops after dispose", async () => {
    const reports: { source: string; error: unknown; route: string | null }[] = [];
    const { platform } = fakeBackend(signedIn(1));
    const Broken = defineComponent({ setup() { return () => { throw new Error("render failed"); }; } });
    const feature = defineFeature({ id: "x", routes: [{ name: "home", path: "/home", component: page("home") }, { name: "broken", path: "/broken", component: Broken }] });
    const application = createApplication(options(platform, [login, feature], "/home", { onError: (report) => reports.push(report) }));
    await start(application);

    await application.router.push("/broken").catch(() => {});
    await settle();
    const rejection = new Event("unhandledrejection");
    Object.assign(rejection, { reason: new Error("lost promise") });
    window.dispatchEvent(rejection);
    window.dispatchEvent(new ErrorEvent("error", { error: new Error("uncaught") }));
    window.dispatchEvent(new ErrorEvent("error", { message: "Script error." })); // a failed <img>: no error object, nothing to report

    expect(reports.map((report) => report.source)).toEqual(["vue", "unhandledrejection", "window"]);
    expect(reports[0]).toMatchObject({ route: "/broken" });

    application.dispose();
    window.dispatchEvent(new ErrorEvent("error", { error: new Error("after dispose") }));
    expect(reports).toHaveLength(3);
  });
});
