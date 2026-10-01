import { render } from "@testing-library/vue";
import { createApp, defineComponent, h } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, scriptedTransport } from "../testing";
import { parseBootstrap } from "./bootstrap";
import { MissingContextError } from "./context";
import { createPlatform, installPlatform, usePlatform } from "./platform";
import type { SessionAdapter } from "./session";
import { deferred, held, mePayload, snapshotOf } from "./testing";

const config = (extra: Record<string, unknown> = {}) => parseBootstrap({ locale: "hr", api_base: "/api/v1", ...extra });

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("beforeSignOut", () => {
  it("runs at sign-out while the session still exists, before the server is told and before the state clears", async () => {
    const order: string[] = [];
    const adapter: SessionAdapter = { load: async () => snapshotOf(4), signOut: async () => void order.push("server") };
    const platform = createPlatform({
      config: config(),
      session: adapter,
      beforeSignOut: async (user) => void order.push(`hook:${user.id}:${platform.session.state.value.status}`),
    });
    await platform.session.restore();

    await platform.session.signOut();

    expect(order).toEqual(["hook:4:authenticated", "server"]);
  });
});

describe("createPlatform has no side effects", () => {
  it("makes no request, starts no timer and adds no listener", () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const transport = vi.fn();
    const listeners = [vi.spyOn(window, "addEventListener"), vi.spyOn(document, "addEventListener")];
    createPlatform({ config: config(), transport });
    expect(transport).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    for (const spy of listeners) expect(spy).not.toHaveBeenCalled();
  });

  it("asks for the session only when told to", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(200, mePayload(3, { "crm.lead:view": held("organization", undefined) })));
    const platform = createPlatform({ config: config(), transport });
    expect(platform.session.state.value.status).toBe("unknown");
    expect(platform.access.can("crm.lead:view")).toBe(false);
    await platform.session.restore();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("/api/v1/auth/me"); // apiBase from the config
    expect(platform.access.can("crm.lead:view")).toBe(true);
  });
});

describe("two platforms share nothing", () => {
  it("keep their own transport, session, access and config", async () => {
    const a = scriptedTransport(jsonResponse(200, mePayload(1, { "a:view": held("organization", undefined) })));
    const b = scriptedTransport(jsonResponse(401, { success: false, error: "none" }));
    const first = createPlatform({ config: config({ app_name: "A" }), transport: a.transport });
    const second = createPlatform({ config: config({ app_name: "B" }), transport: b.transport });
    await Promise.all([first.session.restore(), second.session.restore()]);
    expect(first.session.state.value.status).toBe("authenticated");
    expect(second.session.state.value.status).toBe("anonymous");
    expect(first.access.can("a:view")).toBe(true);
    expect(second.access.can("a:view")).toBe(false);
    expect([a.calls.length, b.calls.length]).toEqual([1, 1]);
    expect(first.http).not.toBe(second.http);
    expect(first.session).not.toBe(second.session);
    expect(first.config.appName).toBe("A");
    expect(second.config.appName).toBe("B");

    first.session.expire();
    second.session.establish(snapshotOf(9));
    expect(first.session.state.value.status).toBe("anonymous");
    expect(second.session.state.value).toMatchObject({ status: "authenticated", user: { id: 9 } });
  });

  it("one expiry does not renew or expire the other", async () => {
    const onExpiredA = vi.fn();
    const onExpiredB = vi.fn();
    const a = createPlatform({ config: config(), transport: scriptedTransport(jsonResponse(401, { success: false, error: "x" })).transport, onSessionExpired: onExpiredA });
    const b = createPlatform({ config: config(), transport: scriptedTransport(jsonResponse(200, { success: true })).transport, onSessionExpired: onExpiredB });
    a.session.establish(snapshotOf(1));
    b.session.establish(snapshotOf(2));
    await a.http.get("/x").catch(() => undefined);
    expect(onExpiredA).toHaveBeenCalledOnce();
    expect(onExpiredB).not.toHaveBeenCalled();
    expect(b.session.state.value.status).toBe("authenticated");
  });
});

describe("401 handling", () => {
  const expired = () => jsonResponse(401, { success: false, error: "expired" });

  it("expires a signed-in session and lets the request fail; the application decides what happens next", async () => {
    const onSessionExpired = vi.fn();
    const platform = createPlatform({ config: config(), transport: scriptedTransport(expired()).transport, onSessionExpired });
    platform.session.establish(snapshotOf(1, { "a:view": held("organization", undefined) }));
    await expect(platform.http.get("/leads")).rejects.toMatchObject({ kind: "unauthorized" });
    expect(platform.session.state.value).toEqual({ status: "anonymous", reason: "expired" });
    expect(platform.access.can("a:view")).toBe(false); // access follows the session
    expect(onSessionExpired).toHaveBeenCalledOnce();
  });

  it("leaves a session that is not signed in alone (a public page's 401 is not an expiry)", async () => {
    const onSessionExpired = vi.fn();
    const platform = createPlatform({ config: config(), transport: scriptedTransport(expired()).transport, onSessionExpired });
    await expect(platform.http.get("/public")).rejects.toMatchObject({ kind: "unauthorized" });
    expect(platform.session.state.value.status).toBe("unknown");
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it("renews once for concurrent 401s and retries each request, which ARV never did", async () => {
    const renewed = deferred<boolean>();
    let token = "old";
    const { transport, calls } = scriptedTransport(() => (token === "old" ? expired() : jsonResponse(200, { success: true, data: "ok" })));
    const renewSession = vi.fn(() => {
      token = "new";
      return renewed.promise;
    });
    const platform = createPlatform({ config: config(), transport, renewSession });
    platform.session.establish(snapshotOf(1));
    const requests = Promise.all([platform.http.get("/a"), platform.http.get("/b"), platform.http.get("/c")]);
    await vi.waitFor(() => expect(renewSession).toHaveBeenCalled());
    renewed.resolve(true);
    const results = await requests;
    expect(results.map((result) => result.data)).toEqual(["ok", "ok", "ok"]);
    expect(renewSession).toHaveBeenCalledOnce();
    expect(calls).toHaveLength(6);
    expect(platform.session.state.value.status).toBe("authenticated");
  });

  it("expires the session when renewal is refused or throws", async () => {
    for (const renewSession of [async () => false, async () => Promise.reject(new Error("refresh failed"))]) {
      const platform = createPlatform({ config: config(), transport: scriptedTransport(expired()).transport, renewSession });
      platform.session.establish(snapshotOf(1));
      await expect(platform.http.get("/a")).rejects.toMatchObject({ kind: "unauthorized" });
      expect(platform.session.state.value).toEqual({ status: "anonymous", reason: "expired" });
    }
  });

  it("does not treat the session request's own 401 as an expiry", async () => {
    const onSessionExpired = vi.fn();
    const platform = createPlatform({ config: config(), transport: scriptedTransport(expired()).transport, onSessionExpired });
    expect((await platform.session.restore()).status).toBe("anonymous");
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it("hands the session to renewSession so it can refresh it", async () => {
    let answered = 0;
    const { transport } = scriptedTransport(() => {
      answered++;
      return answered === 1 ? expired() : jsonResponse(200, mePayload(1));
    });
    const platform = createPlatform({
      config: config(),
      transport,
      renewSession: async (session) => (await session.refresh()).status === "authenticated",
    });
    platform.session.establish(snapshotOf(1));
    // first call 401 -> renewSession -> refresh() reads /auth/me (200) -> retry answers 200
    await expect(platform.http.get("/a")).resolves.toMatchObject({ status: 200 });
  });
});

describe("custom adapters", () => {
  it("takes a session adapter, or a function over the platform's client", async () => {
    const adapter: SessionAdapter<{ id: number; name: string }> = {
      load: async () => ({ user: { id: 1, name: "Ana" }, expiresAt: null, access: { root: false, permissions: {}, unavailable: [] } }),
      signOut: async () => {},
    };
    const direct = createPlatform({ config: config(), session: adapter });
    const state = await direct.session.restore();
    expect(state.status === "authenticated" && state.user.name).toBe("Ana");

    let received: unknown;
    const viaFunction = createPlatform({ config: config(), session: (http) => ((received = http), adapter) });
    expect(received).toBe(viaFunction.http);
  });

  it("uses the transport for every request, and its headers", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(200, { success: true }));
    const platform = createPlatform({ config: config(), transport, headers: () => ({ "X-Tenant": "t1" }) });
    await platform.http.post("/x", { a: 1 });
    expect(calls[0]?.headers.get("X-Tenant")).toBe("t1");
  });
});

describe("as an environment", () => {
  const Probe = defineComponent({
    setup() {
      const platform = usePlatform();
      return () => h("p", platform.config.appName ?? "unnamed");
    },
  });

  it("is installed once and read anywhere below", () => {
    const platform = createPlatform({ config: config({ app_name: "Helpdesk" }), session: undefined });
    const app = createApp(Probe);
    installPlatform(app, platform);
    const host = document.createElement("div");
    app.mount(host);
    expect(host.textContent).toBe("Helpdesk");
    app.unmount();
  });

  it("two apps read their own platform", () => {
    const hosts = ["A", "B"].map((name) => {
      const app = createApp(Probe);
      installPlatform(app, createPlatform({ config: config({ app_name: name }) }));
      const host = document.createElement("div");
      app.mount(host);
      return host.textContent;
    });
    expect(hosts).toEqual(["A", "B"]);
  });

  it("fails with an actionable error when the platform was never installed", () => {
    expect(() => render(Probe)).toThrow(MissingContextError);
    expect(() => render(Probe)).toThrow(/"platform" was not provided/);
  });
});
