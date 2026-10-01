import { describe, expect, it, vi } from "vitest";
import { createHttpClient } from "./client";
import { ApiError, isAborted, isApiError } from "./error";
import { jsonResponse, scriptedTransport } from "../testing";

const failure = async (promise: Promise<unknown>): Promise<ApiError> => {
  try {
    await promise;
  } catch (error) {
    if (isApiError(error)) return error;
    throw error;
  }
  throw new Error("expected the request to fail");
};

describe("success and the envelope", () => {
  it("unwraps go-core's envelope: data, meta, message, status", async () => {
    const { transport } = scriptedTransport(jsonResponse(200, { success: true, data: { id: 1 }, meta: { total: 1 }, message: "ok" }));
    const result = await createHttpClient({ transport }).get<{ id: number }, { total: number }>("/things/1");
    expect(result).toMatchObject({ data: { id: 1 }, meta: { total: 1 }, message: "ok", status: 200 });
  });

  it("treats an enveloped null, and an envelope without data, as data null (ARV read the latter as the payload)", async () => {
    const { transport } = scriptedTransport(jsonResponse(200, { success: true, data: null }), jsonResponse(200, { success: true }));
    const client = createHttpClient({ transport });
    expect((await client.get("/a")).data).toBeNull();
    expect((await client.get("/b")).data).toBeNull();
  });

  it("returns a body without the envelope as the data itself", async () => {
    const { transport } = scriptedTransport(jsonResponse(200, { user: { id: 7 }, expires_at: "x" }));
    const result = await createHttpClient({ transport }).get<{ user: { id: number } }>("/auth/me");
    expect(result.data.user.id).toBe(7);
    expect(result.meta).toBeNull();
  });

  it("reads 204 and an empty body as data null, without a JSON error", async () => {
    const { transport } = scriptedTransport(new Response(null, { status: 204 }), new Response("", { status: 200 }));
    const client = createHttpClient({ transport });
    expect(await client.delete("/things/1")).toMatchObject({ data: null, status: 204 });
    expect((await client.post("/x")).data).toBeNull();
  });

  it("fails as malformed when a success answer is not JSON", async () => {
    const { transport } = scriptedTransport(new Response("<html>gateway</html>", { status: 200 }));
    const error = await failure(createHttpClient({ transport }).get("/x"));
    expect(error).toMatchObject({ kind: "malformed", status: 200 });
  });
});

describe("the request", () => {
  it("joins base url and path, drops empty query values and repeats array keys", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(200, { success: true }));
    await createHttpClient({ transport, baseUrl: "/api/v1/" }).get("/leads", {
      query: { q: "a b", page: 2, empty: "", none: null, skip: undefined, tag: ["x", "y"], on: false },
    });
    expect(calls[0]?.url).toBe("/api/v1/leads?q=a+b&page=2&tag=x&tag=y&on=false");
  });

  it("keeps an absolute url and appends to an existing query string", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(200, { success: true }));
    await createHttpClient({ transport, baseUrl: "/api" }).get("https://other.test/x?a=1", { query: { b: 2 } });
    expect(calls[0]?.url).toBe("https://other.test/x?a=1&b=2");
  });

  it("sends JSON with its content type, credentials, and the methods it was asked for", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(200, { success: true }));
    const client = createHttpClient({ transport });
    await client.post("/a", { n: 1 });
    await client.put("/a", [1]);
    await client.patch("/a", { p: true });
    await client.delete("/a");
    expect(calls.map((call) => call.init.method)).toEqual(["POST", "PUT", "PATCH", "DELETE"]);
    expect(calls[0]?.init.body).toBe('{"n":1}');
    expect(calls[0]?.headers.get("Content-Type")).toBe("application/json");
    expect(calls[0]?.headers.get("Accept")).toBe("application/json");
    expect(calls[0]?.init.credentials).toBe("include");
    expect(calls[3]?.init.body).toBeUndefined();
    expect(calls[3]?.headers.has("Content-Type")).toBe(false);
  });

  it("sends multipart when an object holds a file, with ISO dates and JSON for nested values (ARV sent [object Object])", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(200, { success: true }));
    const file = new File(["x"], "a.txt");
    await createHttpClient({ transport }).post("/upload", {
      file,
      when: new Date("2026-01-02T03:04:05Z"),
      nested: { a: 1 },
      tags: ["x", "y"],
      skipped: null,
      flag: true,
    });
    const form = calls[0]?.init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("file")).toBeInstanceOf(File);
    expect(form.get("when")).toBe("2026-01-02T03:04:05.000Z");
    expect(form.get("nested")).toBe('{"a":1}');
    expect(form.getAll("tags[]")).toEqual(["x", "y"]);
    expect(form.has("skipped")).toBe(false);
    expect(form.get("flag")).toBe("true");
    expect(calls[0]?.headers.has("Content-Type")).toBe(false);
  });

  it("passes raw bodies through untouched", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(200, { success: true }));
    const form = new FormData();
    await createHttpClient({ transport }).post("/a", form);
    expect(calls[0]?.init.body).toBe(form);
  });

  it("merges client headers (read per request) under per-call headers", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(200, { success: true }));
    let token = "one";
    const client = createHttpClient({ transport, headers: () => ({ Authorization: token, "X-App": "a" }) });
    await client.get("/a");
    token = "two";
    await client.get("/a", { headers: { "X-App": "override" } });
    expect(calls[0]?.headers.get("Authorization")).toBe("one");
    expect(calls[1]?.headers.get("Authorization")).toBe("two");
    expect(calls[1]?.headers.get("X-App")).toBe("override");
  });

  it("does not touch the global fetch unless it is the transport", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(200, { success: true }));
    await createHttpClient().get("/a");
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

describe("request ids", () => {
  it("sends a valid id and returns the server's when it answers with one", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(200, { success: true }, { "X-Request-ID": "server-id" }));
    const result = await createHttpClient({ transport }).get("/a");
    expect(calls[0]?.headers.get("X-Request-ID")).toMatch(/^[a-zA-Z0-9\-_]{1,128}$/);
    expect(result.requestId).toBe("server-id");
  });

  it("falls back to the sent id, on success and on errors that carry none", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(200, { success: true }), jsonResponse(500, { success: false, error: "boom" }));
    const client = createHttpClient({ transport });
    const sent = () => calls.at(-1)?.headers.get("X-Request-ID");
    const ok = await client.get("/a");
    expect(ok.requestId).toBe(sent());
    const error = await failure(client.get("/b"));
    expect(error.requestId).toBe(sent());
  });

  it("carries the id on the server's error answer, which ARV's requestVoid dropped", async () => {
    const { transport } = scriptedTransport(jsonResponse(409, { success: false, error: "in use" }, { "X-Request-ID": "abc" }));
    expect((await failure(createHttpClient({ transport }).delete("/a"))).requestId).toBe("abc");
  });

  it("can be customised or turned off", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(200, { success: true }));
    await createHttpClient({ transport, requestId: () => "fixed" }).get("/a");
    await createHttpClient({ transport, requestId: false }).get("/a");
    expect(calls[0]?.headers.get("X-Request-ID")).toBe("fixed");
    expect(calls[1]?.headers.has("X-Request-ID")).toBe(false);
  });
});

describe("every error kind", () => {
  const cases: [number, unknown, string][] = [
    [401, { success: false, error: "no" }, "unauthorized"],
    [403, { success: false, error: "no" }, "forbidden"],
    [404, { success: false, error: "no" }, "notFound"],
    [409, { success: false, error: "no" }, "conflict"],
    [422, { success: false, message: "bad", errors: { name: ["required"] } }, "validation"],
    [400, { success: false, message: "bad", errors: { name: ["required"] } }, "validation"],
    [400, { success: false, error: "bad request" }, "rejected"],
    [429, { success: false, error: "slow down" }, "rejected"],
    [500, { success: false, error: "boom" }, "server"],
    [503, undefined, "server"],
  ];
  it.each(cases)("%i %j is %s", async (status, body, kind) => {
    const { transport } = scriptedTransport(jsonResponse(status, body));
    const error = await failure(createHttpClient({ transport, requestId: false }).get("/a"));
    expect(error).toBeInstanceOf(Error);
    expect(error.kind).toBe(kind);
    expect(error.status).toBe(status);
  });

  it("carries the message, reason code, params and field messages", async () => {
    const { transport } = scriptedTransport(
      jsonResponse(422, { success: false, message: "Validation failed", errors: { name: ["required", "too short"], age: "must be a number" } }),
      jsonResponse(409, { success: false, error: "Role in use", code: "iam.role_in_use", params: { count: 3 }, fields: { role: "in use" } }),
    );
    const client = createHttpClient({ transport });
    const validation = await failure(client.post("/a", {}));
    expect(validation.message).toBe("Validation failed");
    expect(validation.fields).toEqual({ name: ["required", "too short"], age: ["must be a number"] });
    const conflict = await failure(client.delete("/b"));
    expect(conflict).toMatchObject({ message: "Role in use", code: "iam.role_in_use", params: { count: 3 }, fields: { role: ["in use"] } });
    expect(conflict.payload).toMatchObject({ code: "iam.role_in_use" });
  });

  it("has a readable message when the error body is not JSON, and empty fields", async () => {
    const { transport } = scriptedTransport(new Response("<html>bad gateway</html>", { status: 502 }));
    const error = await failure(createHttpClient({ transport }).get("/a"));
    expect(error.message).toBe("Request failed with status 502");
    expect(error.fields).toEqual({});
    expect(error.code).toBeNull();
  });

  it("is a network error, with no status, when the transport rejects; the cause is kept", async () => {
    const cause = new TypeError("Failed to fetch");
    const { transport } = scriptedTransport(cause);
    const error = await failure(createHttpClient({ transport }).get("/a"));
    expect(error).toMatchObject({ kind: "network", status: null, message: "Failed to fetch" });
    expect(error.cause).toBe(cause);
    expect(error.requestId).not.toBeNull();
  });
});

describe("abort", () => {
  it("passes the signal to the transport and fails as aborted, never as a network or server error", async () => {
    const controller = new AbortController();
    const transport = vi.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
    );
    const pending = createHttpClient({ transport }).get("/slow", { signal: controller.signal });
    controller.abort();
    const error = await failure(pending);
    expect(transport.mock.calls[0]?.[1].signal).toBe(controller.signal);
    expect(isAborted(error)).toBe(true);
    expect(error.status).toBeNull();
  });

  it("does not send a request whose signal is already aborted", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(200, { success: true }));
    const controller = new AbortController();
    controller.abort();
    expect(isAborted(await failure(createHttpClient({ transport }).get("/a", { signal: controller.signal })))).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("is aborted when the signal fires while the body is being read", async () => {
    const controller = new AbortController();
    const transport = async () => {
      const response = jsonResponse(200, { success: true });
      vi.spyOn(response, "text").mockImplementation(async () => {
        controller.abort();
        throw new DOMException("aborted", "AbortError");
      });
      return response;
    };
    expect(isAborted(await failure(createHttpClient({ transport }).get("/a", { signal: controller.signal })))).toBe(true);
  });

  it("isAborted is false for other errors and non-errors", () => {
    expect(isAborted(new ApiError({ kind: "network", message: "x" }))).toBe(false);
    expect(isAborted(new Error("x"))).toBe(false);
    expect(isAborted(undefined)).toBe(false);
  });
});

describe("the 401 hook", () => {
  it("retries once when the handler renews the session, and returns the retried result", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(401, { success: false, error: "expired" }), jsonResponse(200, { success: true, data: 1 }));
    const onUnauthorized = vi.fn(async () => "retry" as const);
    const result = await createHttpClient({ transport, onUnauthorized }).get("/a");
    expect(result.data).toBe(1);
    expect(calls).toHaveLength(2);
    expect(onUnauthorized).toHaveBeenCalledWith(expect.objectContaining({ method: "GET", path: "/a" }));
  });

  it("refreshes headers on the retry (a renewed token)", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(401, { success: false, error: "expired" }), jsonResponse(200, { success: true }));
    let token = "old";
    const client = createHttpClient({
      transport,
      headers: () => ({ Authorization: token }),
      onUnauthorized: () => {
        token = "new";
        return "retry";
      },
    });
    await client.get("/a");
    expect(calls.map((call) => call.headers.get("Authorization"))).toEqual(["old", "new"]);
  });

  it("never loops: a second 401 after the retry fails", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(401, { success: false, error: "expired" }));
    const onUnauthorized = vi.fn(() => "retry" as const);
    const error = await failure(createHttpClient({ transport, onUnauthorized }).get("/a"));
    expect(error.kind).toBe("unauthorized");
    expect(calls).toHaveLength(2);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("fails with the original 401 when the handler says fail", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(401, { success: false, error: "expired" }));
    const error = await failure(createHttpClient({ transport, onUnauthorized: () => "fail" }).get("/a"));
    expect(error.kind).toBe("unauthorized");
    expect(calls).toHaveLength(1);
  });

  it("is skipped for calls that opt out, and for other statuses", async () => {
    const { transport } = scriptedTransport(jsonResponse(401, { success: false, error: "wrong password" }), jsonResponse(403, { success: false, error: "no" }));
    const onUnauthorized = vi.fn(() => "retry" as const);
    const client = createHttpClient({ transport, onUnauthorized });
    expect((await failure(client.post("/login", {}, { handleUnauthorized: false }))).kind).toBe("unauthorized");
    expect((await failure(client.get("/x"))).kind).toBe("forbidden");
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("does not retry a request that was aborted while the handler ran", async () => {
    const controller = new AbortController();
    const { transport, calls } = scriptedTransport(jsonResponse(401, { success: false, error: "expired" }), jsonResponse(200, { success: true }));
    const client = createHttpClient({
      transport,
      onUnauthorized: () => {
        controller.abort();
        return "retry";
      },
    });
    expect(isAborted(await failure(client.get("/a", { signal: controller.signal })))).toBe(true);
    expect(calls).toHaveLength(1);
  });
});

describe("independence", () => {
  it("two clients share no state", async () => {
    const a = scriptedTransport(jsonResponse(200, { success: true, data: "a" }));
    const b = scriptedTransport(jsonResponse(200, { success: true, data: "b" }));
    const [ra, rb] = await Promise.all([createHttpClient({ transport: a.transport }).get("/x"), createHttpClient({ transport: b.transport }).get("/x")]);
    expect([ra.data, rb.data]).toEqual(["a", "b"]);
    expect([a.calls.length, b.calls.length]).toEqual([1, 1]);
  });
});
