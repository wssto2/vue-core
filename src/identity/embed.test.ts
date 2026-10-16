import { describe, expect, it, vi } from "vitest";
import { createPlatform, parseBootstrap } from "../platform";
import { jsonResponse, routedTransport } from "../testing";
import fixture from "../../test-data/go-core/session_payload.json";
import { embedSession, type EmbedStorage } from "./embed";
import { identityPlatform } from "./session";

const config = parseBootstrap({ locale: "en", app_name: "Test", api_base: "/api" });
const unauthorized = jsonResponse(401, { success: false, error: "no", code: "identity.session.invalid" });
const later = () => new Date(Date.now() + 3_600_000).toISOString();
const earlier = () => new Date(Date.now() - 3_600_000).toISOString();
const memory = (): EmbedStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value), removeItem: (key) => void data.delete(key) };
};
const pathsOf = (calls: readonly { method: string; url: string }[]) => calls.map((call) => `${call.method} ${new URL(call.url, "http://x").pathname}`);

function over(routes: Parameters<typeof routedTransport>[0], embed = embedSession({ storage: memory() })) {
  const { transport, calls } = routedTransport(routes);
  const platform = createPlatform({ config, transport, ...identityPlatform({ embed }) });
  return { platform, calls, embed };
}

describe("embedSession", () => {
  it("keeps the token and its end in the storage, under the keys it was given", () => {
    const storage = memory();
    const embed = embedSession({ storage, tokenKey: "t", expiresKey: "e" });
    expect(embed.active()).toBe(false);
    expect(embed.expired()).toBe(true);
    embed.start("jwt", later());
    expect(storage.data.get("t")).toBe("jwt");
    expect(embed.token()).toBe("jwt");
    expect(embed.active()).toBe(true);
    expect(embed.expired()).toBe(false);
    embed.end();
    expect(storage.data.size).toBe(0);
    expect(embed.active()).toBe(false);
  });

  it("uses the tab's sessionStorage by default, with the keys a host page already writes", () => {
    sessionStorage.setItem("embed_access_token", "jwt");
    sessionStorage.setItem("embed_expires_at", earlier());
    const embed = embedSession();
    expect([embed.token(), embed.expired()]).toEqual(["jwt", true]);
    embed.end();
    expect(sessionStorage.getItem("embed_access_token")).toBeNull();
  });

  it("reads as no session when the storage is blocked, and keeps nothing", () => {
    const blocked: EmbedStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    const embed = embedSession({ storage: blocked });
    expect(() => embed.start("jwt", later())).not.toThrow();
    expect(() => embed.end()).not.toThrow();
    expect([embed.token(), embed.active()]).toEqual([null, false]);
  });
});

describe("identityPlatform({ embed })", () => {
  it("sends the token as a bearer header, reads the session with it and never refreshes", async () => {
    const embed = embedSession({ storage: memory() });
    embed.start("jwt", later());
    const { platform, calls } = over({ "GET /api/v1/auth/me": jsonResponse(200, fixture), "POST /api/v1/auth/refresh": jsonResponse(200, fixture) }, embed);
    expect((await platform.session.restore()).status).toBe("authenticated");
    expect(calls[0]!.headers.get("Authorization")).toBe("Bearer jwt");
    expect(platform.session.renewable).toBe(false);
  });

  it("is the cookie session, renewable, while no token is held", async () => {
    const { platform, calls } = over({ "GET /api/v1/auth/me": unauthorized, "POST /api/v1/auth/refresh": jsonResponse(200, fixture) });
    expect((await platform.session.restore()).status).toBe("authenticated");
    expect(pathsOf(calls)).toEqual(["GET /api/v1/auth/me", "POST /api/v1/auth/refresh"]);
    expect(calls[0]!.headers.get("Authorization")).toBeNull();
    expect(platform.session.renewable).toBe(true);
  });

  it("says nobody is signed in, without asking the server, when the token has run out, and forgets it", async () => {
    const embed = embedSession({ storage: memory() });
    embed.start("jwt", earlier());
    const { platform, calls } = over({ "GET /api/v1/auth/me": jsonResponse(200, fixture) }, embed);
    expect(await platform.session.restore()).toEqual({ status: "anonymous", reason: "none" });
    expect(calls).toHaveLength(0);
    expect(embed.active()).toBe(false);
  });

  it("forgets a token the server refuses, without trying a refresh", async () => {
    const embed = embedSession({ storage: memory() });
    embed.start("jwt", later());
    const { platform, calls } = over({ "GET /api/v1/auth/me": unauthorized, "POST /api/v1/auth/refresh": jsonResponse(200, fixture) }, embed);
    expect(await platform.session.restore()).toEqual({ status: "anonymous", reason: "none" });
    expect(pathsOf(calls)).toEqual(["GET /api/v1/auth/me"]);
    expect(embed.active()).toBe(false);
  });

  it("ends the session on a 401 at once and forgets the token", async () => {
    const embed = embedSession({ storage: memory() });
    embed.start("jwt", later());
    const { platform, calls } = over({ "GET /api/v1/auth/me": jsonResponse(200, fixture), "GET /api/v1/things": unauthorized, "POST /api/v1/auth/refresh": jsonResponse(200, fixture) }, embed);
    await platform.session.restore();
    await expect(platform.http.get("/v1/things")).rejects.toBeTruthy();
    expect(platform.session.state.value).toEqual({ status: "anonymous", reason: "expired" });
    expect(embed.active()).toBe(false);
    expect(pathsOf(calls)).not.toContain("POST /api/v1/auth/refresh");
  });

  it("forgets the token when signing out, even if the server says the session is gone", async () => {
    const embed = embedSession({ storage: memory() });
    embed.start("jwt", later());
    const { platform } = over({ "GET /api/v1/auth/me": jsonResponse(200, fixture), "POST /api/v1/auth/logout": unauthorized }, embed);
    await platform.session.restore();
    await platform.session.signOut();
    expect(embed.active()).toBe(false);
  });

  it("keeps the application's own renewable() for the cookie session", () => {
    const renewable = vi.fn(() => false);
    const { renewable: combined } = identityPlatform({ embed: embedSession({ storage: memory() }), renewable });
    expect(combined?.()).toBe(false);
    expect(renewable).toHaveBeenCalled();
  });
});
