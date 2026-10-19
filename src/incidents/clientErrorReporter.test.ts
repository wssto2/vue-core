import { describe, expect, it, vi } from "vitest";
import type { ApplicationErrorReport } from "../app";
import { ApiError, createHttpClient, type ApiErrorKind, type Transport } from "../client";
import { jsonResponse, scriptedTransport, settle } from "../testing";
import { clientErrorReporter, MAX_REPORTS_PER_SESSION, type ClientErrorReporterOptions } from "./clientErrorReporter";

const ORIGIN = "https://app.example.test";
const frame = (line = 10) => `    at render (${ORIGIN}/assets/app.js:${line}:3)`;
const errorWith = (message: string, stack = `Error: ${message}\n${frame()}`) => Object.assign(new Error(message), { stack });
const aReport = (error: unknown, extra: Partial<ApplicationErrorReport> = {}): ApplicationErrorReport => ({ source: "vue", error, route: "/leads/7?tab=notes#top", ...extra });

function setup(options: { status?: string; answer?: Parameters<typeof scriptedTransport>[0] } & Partial<ClientErrorReporterOptions> = {}) {
  const { status = "authenticated", answer = jsonResponse(204), ...rest } = options;
  const { transport, calls } = scriptedTransport(answer);
  const http = createHttpClient({ baseUrl: "/api", transport });
  const onError = vi.fn();
  const report = clientErrorReporter({ platform: { http, session: { state: { value: { status } } } }, origin: ORIGIN, onError, ...rest });
  const sent = async () => (await settle(), calls.filter((call) => call.url === "/api/v1/incidents/client-errors"));
  return { report, onError, calls, http, sent };
}

describe("clientErrorReporter: what is reported", () => {
  it("posts a component error with its message, stack, route path, browser, version and the last request ids", async () => {
    const { report, sent, http, calls } = setup({ appVersion: "2.4.1" });
    await http.get("/v1/things");
    const error = errorWith("x is undefined");
    report(aReport(error));
    const [call] = await sent();
    expect(call?.method).toBe("POST");
    const body = JSON.parse(String(call?.init.body));
    expect(body).toEqual({
      message: "x is undefined",
      source: "vue",
      stack: error.stack,
      route: "/leads/7",
      browser: navigator.userAgent,
      app_version: "2.4.1",
      request_ids: [calls[0]?.headers.get("X-Request-ID")],
    });
  });

  it.each(["vue", "unhandledrejection", "window"] as const)("reports a %s error, naming its source", async (source) => {
    const { report, sent } = setup();
    report(aReport(errorWith("boom"), { source }));
    const calls = await sent();
    expect(calls).toHaveLength(1);
    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body).toMatchObject({ message: "boom", source });
    expect(body).not.toHaveProperty("detail");
  });

  it("reports a handled error with its source and detail beside the message, which stays the error's own", async () => {
    const { report, sent } = setup();
    report(aReport(errorWith("save failed"), { source: "handled", detail: "vehicle-location-edit" }));
    const [call] = await sent();
    expect(JSON.parse(String(call?.init.body))).toMatchObject({ message: "save failed", source: "handled", detail: "vehicle-location-edit" });
  });

  it("keeps go-core's bounds: the message at 2000 characters, the detail at 255", async () => {
    const { report, sent } = setup();
    report(aReport(errorWith("x".repeat(3000)), { source: "handled", detail: "d".repeat(300) }));
    const [call] = await sent();
    const body = JSON.parse(String(call?.init.body)) as { message: string; detail: string };
    expect(body.message).toBe("x".repeat(2000));
    expect(body.detail).toHaveLength(255);
  });

  it("does not send a handled ApiError, a handled string, or one from another origin or while signed out", async () => {
    const { report, sent } = setup();
    const api = new ApiError({ kind: "server", message: "failed" });
    api.stack = `ApiError: failed\n${frame()}`;
    report(aReport(api, { source: "handled" }));
    report(aReport("a string", { source: "handled" }));
    report(aReport(errorWith("elsewhere", "Error: elsewhere\n    at f (https://other.test/a.js:1:1)"), { source: "handled" }));
    expect(await sent()).toHaveLength(0);
    const signedOut = setup({ status: "none" });
    signedOut.report(aReport(errorWith("boom"), { source: "handled" }));
    expect(await signedOut.sent()).toHaveLength(0);
  });

  it("counts a handled error once per fingerprint, like the others", async () => {
    const { report, sent } = setup();
    report(aReport(errorWith("same"), { source: "handled", detail: "a" }));
    report(aReport(errorWith("same"), { source: "handled", detail: "a" }));
    expect(await sent()).toHaveLength(1);
  });

  it.each(["effect", "messages", "session", "router", "locale"] as const)("does not report a %s failure", async (source) => {
    const { report, sent } = setup();
    report(aReport(errorWith("boom"), { source }));
    expect(await sent()).toHaveLength(0);
  });

  it("does not report what is not an Error (a rejected string, an object)", async () => {
    const { report, sent } = setup();
    report(aReport("just a string", { source: "unhandledrejection" }));
    report(aReport({ message: "looks like one", stack: frame() }, { source: "unhandledrejection" }));
    report(aReport(undefined));
    expect(await sent()).toHaveLength(0);
  });

  it.each<ApiErrorKind>(["validation", "unauthorized", "forbidden", "notFound", "conflict", "rejected", "server", "network", "aborted", "malformed"])("does not report an ApiError of kind %s", async (kind) => {
    const { report, sent } = setup();
    const error = new ApiError({ kind, message: "failed" });
    error.stack = `ApiError: failed\n${frame()}`;
    report(aReport(error, { source: "unhandledrejection" }));
    expect(await sent()).toHaveLength(0);
  });

  it("does not report `Script error.`, with or without the full stop", async () => {
    const { report, sent } = setup();
    report(aReport(errorWith("Script error.", `Error: Script error.\n${frame()}`), { source: "window" }));
    report(aReport(errorWith("script error", `Error: script error\n${frame()}`), { source: "window" }));
    expect(await sent()).toHaveLength(0);
  });

  it("does not report an error of an extension or another origin: no frame of the application's own", async () => {
    const { report, sent } = setup();
    report(aReport(errorWith("from an extension", "Error: from an extension\n    at inject (chrome-extension://abcdef/content.js:1:1)")));
    report(aReport(errorWith("from a cdn", "Error: from a cdn\n    at run (https://cdn.example.test/widget.js:5:5)")));
    report(aReport(errorWith("lookalike", "Error: lookalike\n    at run (https://app.example.test.evil.test/a.js:1:1)")));
    expect(await sent()).toHaveLength(0);
  });

  it("does not report an error with no stack at all", async () => {
    const { report, sent } = setup();
    report(aReport(errorWith("no stack", "")));
    expect(await sent()).toHaveLength(0);
  });

  it("reports an error with a frame of the application's own origin among others", async () => {
    const { report, sent } = setup();
    report(aReport(errorWith("mixed", `Error: mixed\n    at a (https://cdn.example.test/x.js:1:1)\n${frame()}`)));
    expect(await sent()).toHaveLength(1);
  });

  it.each(["unknown", "loading", "anonymous", "failed"])("reports nothing while the session is %s", async (status) => {
    const { report, sent } = setup({ status });
    report(aReport(errorWith("before sign-in")));
    expect(await sent()).toHaveLength(0);
  });

  it("reads the session at the moment of the error, not when the reporter was made", async () => {
    const state = { value: { status: "anonymous" } };
    const { transport, calls } = scriptedTransport(jsonResponse(204));
    const report = clientErrorReporter({ platform: { http: createHttpClient({ transport }), session: { state } }, origin: ORIGIN, onError: vi.fn() });
    report(aReport(errorWith("early")));
    state.value = { status: "authenticated" };
    report(aReport(errorWith("late")));
    await settle();
    expect(calls.map((call) => JSON.parse(String(call.init.body)).message)).toEqual(["late"]);
  });
});

describe("clientErrorReporter: once per page session", () => {
  it("sends one error once, however often it happens", async () => {
    const { report, sent } = setup();
    for (let i = 0; i < 5; i++) report(aReport(errorWith("again")));
    expect(await sent()).toHaveLength(1);
  });

  it("tells errors apart by message and by top frame", async () => {
    const { report, sent } = setup();
    report(aReport(errorWith("same message", `Error: same message\n${frame(10)}`)));
    report(aReport(errorWith("same message", `Error: same message\n${frame(99)}`)));
    report(aReport(errorWith("other message", `Error: other message\n${frame(10)}`)));
    expect(await sent()).toHaveLength(3);
  });

  it("takes the same error from another source or route as the same", async () => {
    const { report, sent } = setup();
    report(aReport(errorWith("shared"), { source: "vue", route: "/a" }));
    report(aReport(errorWith("shared"), { source: "window", route: "/b" }));
    expect(await sent()).toHaveLength(1);
  });

  it("does not count a skipped error as seen, so the same error reports once signed in", async () => {
    const state = { value: { status: "anonymous" } };
    const { transport, calls } = scriptedTransport(jsonResponse(204));
    const report = clientErrorReporter({ platform: { http: createHttpClient({ transport }), session: { state } }, origin: ORIGIN, onError: vi.fn() });
    report(aReport(errorWith("same")));
    state.value = { status: "authenticated" };
    report(aReport(errorWith("same")));
    await settle();
    expect(calls).toHaveLength(1);
  });

  it(`stops at ${MAX_REPORTS_PER_SESSION} distinct errors`, async () => {
    const { report, sent } = setup();
    for (let i = 0; i < MAX_REPORTS_PER_SESSION + 5; i++) report(aReport(errorWith(`error ${i}`)));
    expect(await sent()).toHaveLength(MAX_REPORTS_PER_SESSION);
  });

  it("does not retry a report the server refused or lost: the error counts as reported", async () => {
    const { report, sent } = setup({ answer: jsonResponse(429, { success: false, error: "slow down" }) });
    report(aReport(errorWith("limited")));
    report(aReport(errorWith("limited")));
    expect(await sent()).toHaveLength(1);
  });
});

describe("clientErrorReporter: the payload stays within the server's bounds", () => {
  it("cuts the message, stack, route, browser and version, and keeps the last 20 request ids of at most 100 characters", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(200, { success: true }, { "X-Request-ID": "r".repeat(150) }));
    const http = createHttpClient({ transport });
    for (let i = 0; i < 25; i++) await http.get("/v1/things");
    const report = clientErrorReporter({ platform: { http, session: { state: { value: { status: "authenticated" } } } }, origin: ORIGIN, onError: vi.fn(), appVersion: "v".repeat(300) });
    report(aReport(errorWith("m".repeat(5000), `Error\n${frame()}\n${"s".repeat(30000)}`), { route: `/${"p".repeat(400)}` }));
    await settle();
    const body = JSON.parse(String(calls.at(-1)?.init.body));
    expect(body.message).toHaveLength(2000);
    expect(body.stack).toHaveLength(20000);
    expect(body.route).toHaveLength(255);
    expect(body.app_version).toHaveLength(100);
    expect(body.request_ids).toHaveLength(20);
    expect(body.request_ids.every((id: string) => id.length === 100)).toBe(true);
  });

  it("sends an empty route when there was none", async () => {
    const { report, sent } = setup();
    report(aReport(errorWith("no route"), { route: null }));
    const [call] = await sent();
    expect(JSON.parse(String(call?.init.body)).route).toBe("");
  });
});

describe("clientErrorReporter: it can never become a problem of its own", () => {
  it("hands every report on to onError, reported or not, and the default is the console line", async () => {
    const { report, onError } = setup({ status: "anonymous" });
    const skipped = aReport("a string");
    report(skipped);
    expect(onError).toHaveBeenCalledExactlyOnceWith(skipped);

    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { transport } = scriptedTransport(jsonResponse(204));
    const plain = clientErrorReporter({ platform: { http: createHttpClient({ transport }), session: { state: { value: { status: "authenticated" } } } }, origin: ORIGIN });
    plain(aReport(errorWith("to the console")));
    expect(logged).toHaveBeenCalledOnce();
    logged.mockRestore();
  });

  it.each([
    ["a server error", jsonResponse(500, { success: false, error: "boom" })],
    ["a rate limit", jsonResponse(429, { success: false, error: "slow down" })],
    ["no connection", new Error("offline")],
  ])("is silent when the report fails with %s: no rejection, no second report, onError called once", async (_name, answer) => {
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => rejections.push(reason);
    process.on("unhandledRejection", onRejection);
    const { report, onError, sent } = setup({ answer });
    report(aReport(errorWith("first")));
    expect(await sent()).toHaveLength(1);
    await settle();
    process.off("unhandledRejection", onRejection);
    expect(rejections).toEqual([]);
    expect(onError).toHaveBeenCalledOnce();
  });

  it("does not throw when sending throws at once, and still calls onError", () => {
    const http = { request: () => { throw new Error("the client broke"); }, recentRequestIds: () => [] } as never;
    const onError = vi.fn();
    const report = clientErrorReporter({ platform: { http, session: { state: { value: { status: "authenticated" } } } }, origin: ORIGIN, onError });
    expect(() => report(aReport(errorWith("boom")))).not.toThrow();
    expect(onError).toHaveBeenCalledOnce();
  });

  it("does not throw on a hostile error (a getter that throws), and still calls onError", () => {
    const { report, onError } = setup();
    const hostile = new Error("x");
    Object.defineProperty(hostile, "stack", { get() { throw new Error("no stack for you"); } });
    expect(() => report(aReport(hostile))).not.toThrow();
    expect(onError).toHaveBeenCalledOnce();
  });

  it("keeps the failed report out of a transport that is never answered", () => {
    const transport: Transport = () => new Promise(() => undefined);
    const report = clientErrorReporter({ platform: { http: createHttpClient({ transport }), session: { state: { value: { status: "authenticated" } } } }, origin: ORIGIN, onError: vi.fn() });
    expect(() => report(aReport(errorWith("pending")))).not.toThrow();
  });
});
