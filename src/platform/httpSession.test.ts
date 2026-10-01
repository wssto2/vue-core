import { describe, expect, it } from "vitest";
import { createHttpClient, isApiError, type ApiError } from "../client";
import { jsonResponse, scriptedTransport } from "../testing";
import { httpSessionAdapter, parseSessionPayload } from "./httpSession";
import { mePayload } from "./testing";

const failureOf = async (run: () => unknown): Promise<ApiError> => {
  try {
    await run();
  } catch (error) {
    if (isApiError(error)) return error;
    throw error;
  }
  throw new Error("expected a failure");
};

describe("parseSessionPayload", () => {
  it("reads go-core's payload: minimal user, expiry as a Date, access", () => {
    const snapshot = parseSessionPayload(mePayload(4, { "a:b": { scope: { level: "organization" }, qualifier: "all", clauses: [] } }));
    expect(snapshot.user).toEqual({ id: 4 }); // the default projection keeps only the id
    expect(snapshot.expiresAt).toEqual(new Date("2030-01-01T00:00:00Z"));
    expect(Object.keys(snapshot.access.permissions)).toEqual(["a:b"]);
  });

  it("lets an application project its own user", () => {
    const snapshot = parseSessionPayload(mePayload(4), (raw) => {
      const { id, name } = raw as { id: number; name: string };
      return { id, name };
    });
    expect(snapshot.user.name).toBe("Someone");
  });

  it("has no expiry when the server sends none, and rejects one that is not a date (ARV treated it as never expiring)", () => {
    expect(parseSessionPayload({ ...mePayload(1), expires_at: undefined }).expiresAt).toBeNull();
    const bad = () => parseSessionPayload({ ...mePayload(1), expires_at: "soon" });
    expect(bad).toThrow(/expires_at: expected an ISO date-time string/);
  });

  it("carries the server's menu tree, keeping only what a menu needs", () => {
    const navigation = [
      { i18n: "navigation.crm", children: [{ i18n: "navigation.crm_lead", icon: "userLine", route: "crm.lead", policies: ["crm.lead.view"] }] },
      { i18n: "navigation.home", route: "home", children: null },
    ];
    expect(parseSessionPayload({ ...mePayload(1), navigation }).navigation).toEqual([
      { i18n: "navigation.crm", children: [{ i18n: "navigation.crm_lead", icon: "userLine", route: "crm.lead" }] },
      { i18n: "navigation.home", route: "home" },
    ]);
    expect(parseSessionPayload({ ...mePayload(1), navigation: undefined }).navigation).toBeUndefined();
    expect(() => parseSessionPayload({ ...mePayload(1), navigation: [{ route: "x" }, "y"] })).toThrow(/navigation\[0\]: expected an object with an i18n key; navigation\[1\]/);
    expect(() => parseSessionPayload({ ...mePayload(1), navigation: {} })).toThrow(/navigation: expected an array/);
  });

  it("throws a malformed ApiError naming every problem", async () => {
    const error = await failureOf(() => parseSessionPayload({ user: { name: "x" }, access: { permissions: 1 } }));
    expect(error.kind).toBe("malformed");
    expect(error.message).toContain("user: expected an object with a numeric or string id");
    expect(error.message).toContain("access.permissions: expected an object");
    expect((await failureOf(() => parseSessionPayload("x"))).message).toContain("expected an object");
    expect((await failureOf(() => parseSessionPayload({ user: { id: 1 } }))).message).toContain("access: expected an object");
  });
});

describe("httpSessionAdapter", () => {
  it("loads from the configurable path, unwrapping an envelope if the server sends one", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(200, { success: true, data: mePayload(2) }));
    const adapter = httpSessionAdapter(createHttpClient({ transport, baseUrl: "/api/v1" }), { mePath: "/me" });
    const snapshot = await adapter.load(new AbortController().signal);
    expect(snapshot?.user).toEqual({ id: 2 });
    expect(calls[0]?.url).toBe("/api/v1/me");
    expect(calls[0]?.init.method).toBe("GET");
  });

  it("reads 401 as nobody signed in, not as an error", async () => {
    const { transport } = scriptedTransport(jsonResponse(401, { success: false, error: "no session" }));
    expect(await httpSessionAdapter(createHttpClient({ transport })).load(new AbortController().signal)).toBeNull();
  });

  it("does not run the client's 401 hook for that answer", async () => {
    const { transport } = scriptedTransport(jsonResponse(401, { success: false, error: "no session" }));
    let called = false;
    const http = createHttpClient({ transport, onUnauthorized: () => ((called = true), "retry") });
    await httpSessionAdapter(http).load(new AbortController().signal);
    expect(called).toBe(false);
  });

  it("rejects for other failures and unreadable payloads", async () => {
    const { transport } = scriptedTransport(jsonResponse(500, { success: false, error: "boom" }), jsonResponse(200, { user: {} }));
    const adapter = httpSessionAdapter(createHttpClient({ transport }));
    expect((await failureOf(() => adapter.load(new AbortController().signal))).kind).toBe("server");
    expect((await failureOf(() => adapter.load(new AbortController().signal))).kind).toBe("malformed");
  });

  it("passes the abort signal to the request", async () => {
    const { transport } = scriptedTransport(jsonResponse(200, mePayload(1)));
    const controller = new AbortController();
    controller.abort();
    const error = await failureOf(() => httpSessionAdapter(createHttpClient({ transport })).load(controller.signal));
    expect(error.kind).toBe("aborted");
  });

  it("signs out with a POST to the configured path, and treats 401 as already signed out", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(204, undefined), jsonResponse(401, { success: false, error: "no" }), jsonResponse(500, { success: false, error: "boom" }));
    const adapter = httpSessionAdapter(createHttpClient({ transport }), { signOutPath: "/logout" });
    await adapter.signOut();
    await adapter.signOut();
    expect(calls[0]?.url).toBe("/logout");
    expect(calls[0]?.init.method).toBe("POST");
    expect((await failureOf(() => adapter.signOut())).kind).toBe("server");
  });
});
