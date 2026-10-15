import { describe, expect, it, vi } from "vitest";
import { createHttpClient } from "./client";
import { ApiError, isAborted, isApiError } from "./error";
import { jsonResponse, scriptedTransport } from "../testing";

const file = (headers: Record<string, string> = {}, body = "%PDF") => new Response(body, { status: 200, headers: { "Content-Type": "application/pdf", ...headers } });

const failure = async (promise: Promise<unknown>): Promise<ApiError> => {
  try {
    await promise;
  } catch (error) {
    if (isApiError(error)) return error;
    throw error;
  }
  throw new Error("expected the request to fail");
};

describe("download", () => {
  it("returns the blob, the proposed name and the server's request id", async () => {
    const { transport } = scriptedTransport(file({ "Content-Disposition": 'attachment; filename="a.pdf"', "X-Request-ID": "srv-1" }));
    const client = createHttpClient({ transport });
    const result = await client.download("/doc");
    expect(await result.blob.text()).toBe("%PDF");
    expect(result.blob.type).toBe("application/pdf");
    expect(result).toMatchObject({ filename: "a.pdf", requestId: "srv-1" });
    expect(client.recentRequestIds()).toEqual(["srv-1"]);
  });

  it("has a null filename without Content-Disposition and falls back to the id it sent", async () => {
    const { transport, calls } = scriptedTransport(file());
    const result = await createHttpClient({ transport }).download("/doc");
    expect(result.filename).toBeNull();
    expect(result.requestId).toBe(calls[0]?.headers.get("X-Request-ID"));
  });

  it("sends base url, query, credentials, the headers hook and a per-call header like a JSON call, Accept any type", async () => {
    const { transport, calls } = scriptedTransport(file());
    await createHttpClient({ transport, baseUrl: "/api", headers: () => ({ Authorization: "t" }) }).download("/v1/doc", {
      query: { id: 3 },
      headers: { "X-Extra": "1" },
    });
    expect(calls[0]).toMatchObject({ url: "/api/v1/doc?id=3", method: "GET" });
    expect(calls[0]?.init.credentials).toBe("include");
    expect(calls[0]?.headers.get("Accept")).toBe("*/*");
    expect(calls[0]?.headers.get("Authorization")).toBe("t");
    expect(calls[0]?.headers.get("X-Extra")).toBe("1");
    expect(calls[0]?.headers.get("X-Request-ID")).toMatch(/^[0-9a-f]{32}$/);
  });

  it("overrides Accept per call", async () => {
    const { transport, calls } = scriptedTransport(file());
    await createHttpClient({ transport }).download("/doc", { accept: "application/pdf" });
    expect(calls[0]?.headers.get("Accept")).toBe("application/pdf");
  });

  it("POSTs a body encoded like post: JSON with its content type", async () => {
    const { transport, calls } = scriptedTransport(file());
    await createHttpClient({ transport }).download("/export", { method: "POST", body: { ids: [1, 2] } });
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.init.body).toBe('{"ids":[1,2]}');
    expect(calls[0]?.headers.get("Content-Type")).toBe("application/json");
  });

  it("throws the ApiError of the JSON error body: code, params, fields, kind, request id", async () => {
    const { transport } = scriptedTransport(
      jsonResponse(409, { success: false, error: "taken", code: "doc.locked", params: { by: "ana" }, fields: { name: "dup" } }, { "X-Request-ID": "srv-2" }),
      jsonResponse(404, { success: false, error: "gone" }),
    );
    const client = createHttpClient({ transport });
    const conflict = await failure(client.download("/doc"));
    expect(conflict).toMatchObject({ kind: "conflict", status: 409, message: "taken", code: "doc.locked", params: { by: "ana" }, fields: { name: ["dup"] }, requestId: "srv-2" });
    expect((await failure(client.download("/doc"))).kind).toBe("notFound");
    expect(client.recentRequestIds()[0]).toBe("srv-2");
  });

  it("falls back to a status message when the error body is not JSON", async () => {
    const { transport } = scriptedTransport(new Response("<html>bad gateway</html>", { status: 502 }));
    expect(await failure(createHttpClient({ transport }).download("/doc"))).toMatchObject({ kind: "server", status: 502, message: "Request failed with status 502", code: null });
  });

  it("renews the session on 401 and retries once, with fresh headers", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(401, { success: false, error: "expired" }), file({ "Content-Disposition": "attachment; filename=b.pdf" }));
    let token = "old";
    const onUnauthorized = vi.fn(() => {
      token = "new";
      return "retry" as const;
    });
    const result = await createHttpClient({ transport, headers: () => ({ Authorization: token }), onUnauthorized }).download("/doc");
    expect(result.filename).toBe("b.pdf");
    expect(calls.map((call) => call.headers.get("Authorization"))).toEqual(["old", "new"]);
    expect(onUnauthorized).toHaveBeenCalledWith(expect.objectContaining({ method: "GET", path: "/doc" }));
  });

  it("never loops on a second 401, and skips the hook when the call opts out", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(401, { success: false, error: "expired" }));
    const onUnauthorized = vi.fn(() => "retry" as const);
    const client = createHttpClient({ transport, onUnauthorized });
    expect((await failure(client.download("/doc"))).kind).toBe("unauthorized");
    expect(calls).toHaveLength(2);
    await failure(client.download("/doc", { handleUnauthorized: false }));
    expect(calls).toHaveLength(3);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("fails as aborted, before sending when the signal is already aborted and while the body is read", async () => {
    const controller = new AbortController();
    controller.abort();
    const never = scriptedTransport(file());
    expect(isAborted(await failure(createHttpClient({ transport: never.transport }).download("/doc", { signal: controller.signal })))).toBe(true);
    expect(never.calls).toHaveLength(0);

    const reading = new Response(new ReadableStream({ pull: (stream) => stream.error(new DOMException("aborted", "AbortError")) }));
    expect(isAborted(await failure(createHttpClient({ transport: scriptedTransport(reading).transport }).download("/doc")))).toBe(true);
  });

  it("fails as network when the server cannot be reached", async () => {
    const { transport } = scriptedTransport(new TypeError("offline"));
    expect(await failure(createHttpClient({ transport }).download("/doc"))).toMatchObject({ kind: "network", message: "offline" });
  });
});

describe("stream", () => {
  it("resolves with the raw response, body unread, and asks for the given Accept", async () => {
    const { transport, calls } = scriptedTransport(new Response("data: 1\n\n", { headers: { "Content-Type": "text/event-stream" } }));
    const response = await createHttpClient({ transport, baseUrl: "/api" }).stream("/events", { accept: "text/event-stream" });
    expect(response.bodyUsed).toBe(false);
    expect(await response.text()).toBe("data: 1\n\n");
    expect(calls[0]).toMatchObject({ url: "/api/events", method: "GET" });
    expect(calls[0]?.headers.get("Accept")).toBe("text/event-stream");
    expect(calls[0]?.headers.get("X-Request-ID")).toBeTruthy();
  });

  it("throws an ApiError for a non-2xx answer and retries a 401 once", async () => {
    const { transport, calls } = scriptedTransport(
      jsonResponse(401, { success: false, error: "expired" }),
      jsonResponse(403, { success: false, error: "no", code: "x.denied" }),
    );
    const error = await failure(createHttpClient({ transport, onUnauthorized: () => "retry" }).stream("/events"));
    expect(error).toMatchObject({ kind: "forbidden", code: "x.denied" });
    expect(calls).toHaveLength(2);
  });

  it("passes the signal on, so the caller ends the stream", async () => {
    const controller = new AbortController();
    const { transport, calls } = scriptedTransport(new Response("x"));
    await createHttpClient({ transport }).stream("/events", { signal: controller.signal });
    expect(calls[0]?.init.signal).toBe(controller.signal);
  });
});
