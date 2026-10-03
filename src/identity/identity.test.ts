import { fireEvent, render, screen, waitFor } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import { ApiError } from "../client";
import { createPlatform, parseBootstrap, parseSessionPayload } from "../platform";
import { createTestApp, jsonResponse, routedTransport, settle } from "../testing";
import fixture from "../../test-data/go-core/session_payload.json";
import { identityContextKey } from "./context";
import { identityPlatform, identitySessionAdapter } from "./session";
import { lockedUntil, signIn } from "./signIn";
import SignInPage from "./SignInPage.vue";
import { parseIdentityUser } from "./user";

// The payload exactly as go-core's identity module answers (identity/http/testdata/session_payload.json).
const payload = fixture;
const config = parseBootstrap({ locale: "en", app_name: "Test", api_base: "/api" });

const platformOver = (routes: Parameters<typeof routedTransport>[0]) => {
  const { transport, calls } = routedTransport(routes);
  return { platform: createPlatform({ config, transport, ...identityPlatform() }), calls };
};

describe("the session payload of go-core", () => {
  it("is read by the library's parsers", () => {
    const snapshot = parseSessionPayload(payload.data, parseIdentityUser);
    expect(snapshot.user).toEqual({ id: 1, login: "ana", name: "Ana Anić", email: "ana@example.test", locale: "hr" });
    expect(snapshot.expiresAt?.toISOString()).toBe("2026-01-03T03:04:05.000Z");
    expect(snapshot.access.permissions["tickets.ticket:view"]?.qualifier).toBe("all");
    expect(snapshot.navigation?.[0]?.route).toBe("tickets.index");
  });

  it("restores the session through /v1/auth/me", async () => {
    const { platform, calls } = platformOver({ "GET /api/v1/auth/me": jsonResponse(200, payload) });
    const state = await platform.session.restore();
    expect(state.status).toBe("authenticated");
    expect(platform.access.can("tickets.ticket:view")).toBe(true);
    expect(calls).toHaveLength(1);
  });
});

describe("identitySessionAdapter", () => {
  const unauthorized = jsonResponse(401, { success: false, error: "no", code: "identity.session.invalid" });

  it("refreshes once when the access token ran out while the app was closed", async () => {
    const { platform, calls } = platformOver({ "GET /api/v1/auth/me": unauthorized, "POST /api/v1/auth/refresh": jsonResponse(200, payload) });
    expect((await platform.session.restore()).status).toBe("authenticated");
    expect(calls.map((call) => `${call.method} ${new URL(call.url, "http://x").pathname}`)).toEqual(["GET /api/v1/auth/me", "POST /api/v1/auth/refresh"]);
  });

  it("says nobody is signed in when the refresh is refused too", async () => {
    const { platform } = platformOver({ "GET /api/v1/auth/me": unauthorized, "POST /api/v1/auth/refresh": unauthorized });
    expect(await platform.session.restore()).toEqual({ status: "anonymous", reason: "none" });
  });

  it("does not turn a server fault into a signed-out user", async () => {
    const { platform } = platformOver({ "GET /api/v1/auth/me": jsonResponse(500, { success: false, error: "boom" }) });
    expect((await platform.session.restore()).status).toBe("failed");
  });

  it("ends a session that is already over without complaint", async () => {
    const { transport } = routedTransport({ "POST /api/v1/auth/logout": unauthorized });
    const { http } = createPlatform({ config, transport });
    await expect(identitySessionAdapter(http, parseIdentityUser).signOut()).resolves.toBeUndefined();
  });
});

describe("renewing on a 401", () => {
  it("refreshes the tokens, reads the session again and sends the failed request once more", async () => {
    let answered = 0;
    const { platform, calls } = platformOver({
      "GET /api/v1/auth/me": jsonResponse(200, payload),
      "POST /api/v1/auth/refresh": jsonResponse(200, payload),
      "GET /api/v1/things": () => jsonResponse(++answered === 1 ? 401 : 200, answered === 1 ? { success: false, error: "no" } : { success: true, data: [] }),
    });
    await platform.session.restore();
    await platform.http.get("/v1/things");
    expect(calls.map((call) => call.method + " " + new URL(call.url, "http://x").pathname)).toEqual([
      "GET /api/v1/auth/me", "GET /api/v1/things", "POST /api/v1/auth/refresh", "GET /api/v1/auth/me", "GET /api/v1/things",
    ]);
    expect(platform.session.state.value.status).toBe("authenticated");
  });

  it("expires the session when the refresh token is refused", async () => {
    const { platform } = platformOver({
      "GET /api/v1/auth/me": jsonResponse(200, payload),
      "POST /api/v1/auth/refresh": jsonResponse(401, { success: false, error: "no", code: "identity.session.invalid" }),
      "GET /api/v1/things": jsonResponse(401, { success: false, error: "no" }),
    });
    await platform.session.restore();
    await expect(platform.http.get("/v1/things")).rejects.toBeInstanceOf(ApiError);
    expect(platform.session.state.value).toEqual({ status: "anonymous", reason: "expired" });
  });
});

describe("signIn", () => {
  it("posts the credentials, then reads who is signed in", async () => {
    const { platform, calls } = platformOver({ "POST /api/v1/auth/login": jsonResponse(200, payload), "GET /api/v1/auth/me": jsonResponse(200, payload) });
    await signIn(platform, { login: "ana", password: "secret" });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ login: "ana", password: "secret" });
    expect(platform.session.state.value.status).toBe("authenticated");
  });

  it("rejects with the refusal and leaves nobody signed in", async () => {
    const refusal = { success: false, error: "identity.signin.locked", code: "identity.signin.locked", params: { locked_until: "2026-01-03T10:15:00Z" } };
    const { platform } = platformOver({ "POST /api/v1/auth/login": jsonResponse(422, refusal) });
    const error = await signIn(platform, { login: "ana", password: "x" }).catch((e: unknown) => e);
    expect(lockedUntil(error)?.toISOString()).toBe("2026-01-03T10:15:00.000Z");
    expect(platform.session.state.value.status).not.toBe("authenticated");
  });
});

describe("SignInPage", () => {
  function mountPage(routes: Parameters<typeof routedTransport>[0]) {
    const { platform, calls } = platformOver(routes);
    const app = createTestApp({
      platform,
      location: "/login?redirect=/tickets",
      routes: [{ path: "/login", name: "login", component: SignInPage }, { path: "/tickets", component: { render: () => null } }, { path: "/", component: { render: () => null } }],
      plugins: [{ install: (vue) => vue.provide(identityContextKey, { home: "/" }) }],
    });
    render(SignInPage, { global: { plugins: [...app.plugins] } });
    return { app, calls };
  }
  const type = async (label: string, value: string) => fireEvent.update(screen.getByLabelText(new RegExp(label)), value);

  it("asks for both fields before it asks the server", async () => {
    const { calls } = mountPage({});
    await fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await settle();
    expect(screen.getAllByText("Required.")).toHaveLength(2);
    expect(calls).toHaveLength(0);
  });

  it("says a wrong login or password in one sentence under the password", async () => {
    mountPage({ "POST /api/v1/auth/login": jsonResponse(422, { success: false, error: "identity.signin.failed", code: "identity.signin.failed" }) });
    await type("Username", "ana");
    await type("Password", "wrong");
    await fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Invalid username or password.")).toBeTruthy();
  });

  it("says until when the lock lasts, as a time of day", async () => {
    mountPage({ "POST /api/v1/auth/login": jsonResponse(422, { success: false, error: "x", code: "identity.signin.locked", params: { locked_until: "2026-01-03T10:15:00Z" } }) });
    await type("Username", "ana");
    await type("Password", "wrong");
    await fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    const sentence = await screen.findByText(/Sign-in is locked until/);
    expect(sentence.textContent).toMatch(/until \d{1,2}:15/);
  });

  it("says the attempts came too fast on a 429", async () => {
    mountPage({ "POST /api/v1/auth/login": jsonResponse(429, { success: false, error: "slow down" }) });
    await type("Username", "ana");
    await type("Password", "x");
    await fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Too many requests in a short time. Wait a minute and try again.")).toBeTruthy();
  });

  it("goes where the person was heading once signed in", async () => {
    const { app } = mountPage({ "POST /api/v1/auth/login": jsonResponse(200, payload), "GET /api/v1/auth/me": jsonResponse(200, payload) });
    await app.router.isReady();
    await type("Username", "ana");
    await type("Password", "secret");
    await fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(app.router.currentRoute.value.path).toBe("/tickets"));
  });
});
