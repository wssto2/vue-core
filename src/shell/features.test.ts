import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { toast } from "../overlay";
import { appUpdates, moduleScripts } from "./appUpdates";
import { backofficeShell } from "./backofficeShell";
import { defineFeature } from "../app";
import { page, settle, startShell } from "./testing";
import { viewTransitions } from "./viewTransitions";

const pageOf = (...scripts: string[]) => `<!doctype html><html><body><div id="app"></div>${scripts.map((src) => `<script type="module" src="${src}"></script>`).join("")}</body></html>`;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("moduleScripts", () => {
  it("names the module scripts of a page by path, sorted, ignoring classic scripts and the host", () => {
    const html = `<script src="/a.js"></script><script type="module" src="https://cdn.example/assets/z-2.js"></script><script type="module" src="/assets/a-1.js"></script><script type="module">inline()</script>`;
    expect(moduleScripts(html, "https://app.example/")).toEqual(["/assets/a-1.js", "/assets/z-2.js"]);
  });
});

describe("appUpdates", () => {
  let running: HTMLScriptElement;
  let info: MockInstance<typeof toast.info>;
  const fetchOf = (...answers: (string | Error | number)[]) => {
    const stub = vi.fn(async () => {
      const answer = answers.length > 1 ? answers.shift()! : answers[0]!;
      if (answer instanceof Error) throw answer;
      if (typeof answer === "number") return new Response("down", { status: answer });
      return new Response(answer);
    });
    vi.stubGlobal("fetch", stub);
    return stub;
  };
  const session = undefined;

  beforeEach(() => {
    running = document.createElement("script");
    running.type = "module";
    running.src = "/assets/main-1.js";
    document.head.append(running);
    info = vi.spyOn(toast, "info").mockReturnValue(1);
  });
  afterEach(() => {
    running.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const run = (options: Parameters<typeof appUpdates>[0] = { checkEveryMs: 10 }) => startShell(backofficeShell(), { features: [appUpdates(options)], session });

  it("offers a reload once, when the live page names another build", async () => {
    const stub = fetchOf(pageOf("/assets/main-2.js"));
    await run();
    await wait(60);

    expect(info).toHaveBeenCalledTimes(1);
    const [text, options] = info.mock.calls[0]!;
    expect(text).toBe("A new version of the app is available");
    expect(options).toMatchObject({ duration: Infinity, action: { label: "Reload" } });
    expect(stub).toHaveBeenCalledTimes(1); // once offered, it does not ask again
    expect(stub).toHaveBeenCalledWith("/", { cache: "no-store", credentials: "include" });

    const reload = vi.spyOn(window.location, "reload").mockImplementation(() => undefined);
    (options as { action: { onClick: () => void } }).action.onClick();
    expect(reload).toHaveBeenCalled();
  });

  it("says nothing while the live page is the build that is running", async () => {
    fetchOf(pageOf("/assets/main-1.js"));
    await run();
    await wait(60);
    expect(info).not.toHaveBeenCalled();
  });

  it("does not take an error page, a failing server or a missing network for a new build", async () => {
    for (const answer of [pageOf(), 503, new Error("offline")]) {
      fetchOf(answer);
      const { application } = await run();
      await wait(40);
      application.dispose();
    }
    expect(info).not.toHaveBeenCalled();
  });

  it("checks again when the application comes back to the foreground", async () => {
    const stub = fetchOf(pageOf("/assets/main-1.js"));
    await run({ checkEveryMs: 3_600_000 });
    expect(stub).not.toHaveBeenCalled();

    document.dispatchEvent(new Event("visibilitychange"));
    await settle();

    expect(stub).toHaveBeenCalledTimes(1);
  });

  it("does nothing when disabled, and nothing runs once the application is disposed", async () => {
    const stub = fetchOf(pageOf("/assets/main-2.js"));
    const disabled = await run({ checkEveryMs: 10, enabled: false });
    await wait(40);
    expect(stub).not.toHaveBeenCalled();
    disabled.application.dispose();

    const { application } = await run({ checkEveryMs: 3_600_000 });
    application.dispose();
    document.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(stub).not.toHaveBeenCalled();
  });

  it("leaves no timer behind when disposed", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    fetchOf(pageOf("/assets/main-1.js"));
    const before = vi.getTimerCount();
    const { application } = await run({ checkEveryMs: 1000 });
    const during = vi.getTimerCount();
    application.dispose();
    expect(vi.getTimerCount()).toBeLessThan(during);
    expect(vi.getTimerCount()).toBeLessThanOrEqual(before + 1); // Vue's own dev timer under happy-dom is not ours
    vi.useRealTimers();
  });
});

describe("viewTransitions", () => {
  type Stub = (update: () => Promise<void>) => { ready: Promise<void>; finished: Promise<void> };
  let started: number;
  let narrow: boolean;
  let reduced: boolean;
  const original = document.startViewTransition;
  const originalMedia = window.matchMedia;

  beforeEach(() => {
    started = 0;
    narrow = true;
    reduced = false;
    (document as unknown as { startViewTransition: Stub }).startViewTransition = (update) => {
      started++;
      return { ready: Promise.resolve(), finished: update().then(() => undefined) };
    };
    window.matchMedia = ((query: string) => ({
      matches: query.includes("1023px") ? narrow : query.includes("reduced") ? reduced : false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    (document as unknown as { startViewTransition: unknown }).startViewTransition = original;
    window.matchMedia = originalMedia;
    document.body.classList.remove("overflow-hidden");
  });

  const deep = defineFeature({
    id: "deep",
    routes: [
      { name: "list", path: "/list", component: page("list") },
      { name: "record", path: "/list/7", component: page("record") },
      { name: "section", path: "/list/7/notes", component: page("notes") },
    ],
  });
  const run = (location = "/list") => startShell(backofficeShell(), { features: [deep, viewTransitions()], location });

  it("slides forward to a deeper page and back to a shallower one", async () => {
    const { application } = await run();
    const seen: (string | undefined)[] = [];
    application.router.afterEach(() => void seen.push(document.documentElement.dataset.navDirection));

    await application.router.push({ name: "record" });
    await settle();
    await application.router.push({ name: "list" });
    await settle();

    expect(started).toBe(2);
    expect(seen).toEqual(["forward", "back"]);
    expect(document.documentElement.dataset.navDirection).toBeUndefined();
  });

  it("does not slide on the first navigation, for a query change, on desktop, under reduced motion or behind a dialog", async () => {
    const { application } = await run();
    expect(started).toBe(0); // the first navigation

    await application.router.push({ name: "list", query: { page: "2" } });
    await settle();
    expect(started).toBe(0);

    narrow = false;
    await application.router.push({ name: "record" });
    await settle();
    expect(started).toBe(0);

    narrow = true;
    reduced = true;
    await application.router.push({ name: "list" });
    await settle();
    expect(started).toBe(0);

    reduced = false;
    document.body.classList.add("overflow-hidden");
    await application.router.push({ name: "record" });
    await settle();
    expect(started).toBe(0);
  });

  it("a navigation that begins while the screen is held lets the old one go instead of waiting for it", async () => {
    const { application } = await run();
    await application.router.push({ name: "record" });
    const again = application.router.push({ name: "section" });
    await expect(Promise.race([again.then(() => "landed"), wait(500).then(() => "stuck")])).resolves.toBe("landed");
  });

  it("removes its hooks with the application", async () => {
    const { application } = await run();
    application.dispose();
    const router = application.router;
    await router.push({ name: "record" }).catch(() => undefined);
    expect(started).toBe(0);
  });

  it("leaves the navigation alone in a browser without the API", async () => {
    (document as unknown as { startViewTransition: unknown }).startViewTransition = undefined;
    const { application } = await run();
    await application.router.push({ name: "record" });
    await settle();
    expect(application.router.currentRoute.value.name).toBe("record");
  });
});
