import { describe, expect, expectTypeOf, it } from "vitest";
import { createHttpClient } from "./client";
import { isAborted, isApiError } from "./error";
import { route, type PageMeta } from "./route";
import { jsonResponse, scriptedTransport } from "../testing";

interface Ticket {
  id: number;
  title: string;
}

const show = route<{ id: number; expand?: string }, Ticket>("GET", "/v1/tickets/:id");
const create = route<{ title: string }, Ticket>("POST", "/v1/tickets");
const update = route<{ id: number; title: string }, Ticket>("PUT", "/v1/tickets/:id");
const remove = route<{ id: number }, void>("DELETE", "/v1/tickets/:id");
const send = route<{ id: number }, void>("POST", "/v1/tickets/:id/send-order");
const health = route<void, string>("GET", "/health");

const setup = (...answers: Parameters<typeof scriptedTransport>) => {
  const { transport, calls } = scriptedTransport(...answers);
  return { client: createHttpClient({ transport, baseUrl: "/api" }), calls };
};

describe("client.request", () => {
  it("fills :params (encoded) and sends the rest of a GET as the query", async () => {
    const { client, calls } = setup(jsonResponse(200, { success: true, data: { id: 7, title: "x" } }));
    const result = await client.request(show, { id: 7, expand: "a b" });
    expect(result.data.title).toBe("x");
    expect(calls[0]?.url).toBe("/api/v1/tickets/7?expand=a+b");
    expect(calls[0]?.init.body).toBeUndefined();
  });

  it("encodes path values", async () => {
    const { client, calls } = setup(jsonResponse(200, { id: 1, title: "" }));
    await client.request(route<{ ref: string }, Ticket>("GET", "/v1/roles/:ref"), { ref: "a/b c" });
    expect(calls[0]?.url).toBe("/api/v1/roles/a%2Fb%20c");
  });

  it("sends the rest of POST/PUT as the JSON body; the path parameter is not in it", async () => {
    const { client, calls } = setup(jsonResponse(200, { id: 1, title: "n" }), jsonResponse(200, { id: 2, title: "m" }));
    await client.request(create, { title: "n" });
    await client.request(update, { id: 2, title: "m" });
    expect(calls[0]).toMatchObject({ method: "POST", url: "/api/v1/tickets" });
    expect(calls[0]?.init.body).toBe('{"title":"n"}');
    expect(calls[1]).toMatchObject({ method: "PUT", url: "/api/v1/tickets/2" });
    expect(calls[1]?.init.body).toBe('{"title":"m"}');
  });

  it("sends no body and no query when only path parameters were given", async () => {
    const { client, calls } = setup(new Response(null, { status: 204 }), new Response(null, { status: 204 }));
    const deleted = await client.request(remove, { id: 3 });
    await client.request(send, { id: 3 });
    expect(deleted).toMatchObject({ data: null, status: 204 });
    expect(calls[0]).toMatchObject({ method: "DELETE", url: "/api/v1/tickets/3" });
    expect(calls[1]?.init.body).toBeUndefined();
  });

  it("needs no second argument for a route without input; options are the third", async () => {
    const { client, calls } = setup(jsonResponse(200, { success: true, data: "ok" }));
    const controller = new AbortController();
    expect((await client.request(health)).data).toBe("ok");
    await client.request(health, undefined, { signal: controller.signal, query: { v: 1 } });
    expect(calls[1]?.url).toBe("/api/health?v=1");
  });

  it("throws a plain Error naming the route and the parameter, before sending anything", async () => {
    const { client, calls } = setup(jsonResponse(200, {}));
    const failure = await client.request(show, { id: undefined as unknown as number }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(isApiError(failure)).toBe(false);
    expect((failure as Error).message).toBe('GET /v1/tickets/:id: the input has no value for the path parameter "id"');
    expect(calls).toHaveLength(0);
  });

  it("keeps the abort, 401 and error behaviour of get/post", async () => {
    const controller = new AbortController();
    controller.abort();
    const { client } = setup(jsonResponse(200, {}));
    const aborted = await client.request(health, undefined, { signal: controller.signal }).catch((error: unknown) => error);
    expect(isAborted(aborted)).toBe(true);

    const seen = setup(jsonResponse(401, { message: "no" }), jsonResponse(200, { success: true, data: "again" }));
    const renewing = createHttpClient({ transport: scriptedTransport(jsonResponse(401, {}), jsonResponse(200, { success: true, data: "again" })).transport, onUnauthorized: () => "retry" });
    expect((await renewing.request(health)).data).toBe("again");
    const refused = await seen.client.request(health).catch((error: unknown) => error);
    expect(isApiError(refused) && refused.kind).toBe("unauthorized");
  });
});

describe("typed meta", () => {
  interface Totals {
    total_price: number;
  }
  const withMeta = route<{ id: number }, Ticket, Totals>("GET", "/v1/tickets/:id/totals");
  const page = route<{ page: number }, Ticket[], PageMeta>("GET", "/v1/tickets");

  it("types the meta a route declares; a route without one keeps unknown", async () => {
    const { client } = setup(
      jsonResponse(200, { success: true, data: { id: 1, title: "x" }, meta: { total_price: 12 } }),
      jsonResponse(200, { success: true, data: [], meta: { total: 0, page: 1, per_page: 25, last_page: 0, from: 0, to: 0 } }),
      jsonResponse(200, { success: true, data: { id: 1, title: "x" } }),
    );
    const typed = await client.request(withMeta, { id: 1 });
    expectTypeOf(typed.meta).toEqualTypeOf<Totals | null>();
    expect(typed.meta?.total_price).toBe(12);
    const paged = await client.request(page, { page: 1 });
    expectTypeOf(paged.meta).toEqualTypeOf<PageMeta | null>();
    expectTypeOf(paged.data).toEqualTypeOf<Ticket[]>();
    const plain = await client.request(show, { id: 1 });
    expectTypeOf(plain.meta).toEqualTypeOf<unknown>();
  });
});

describe("RequestOptions.idempotencyKey", () => {
  it("sends the key of the attempt as Idempotency-Key on a route call, on a plain call and again on the retry after a renewed session", async () => {
    const { transport, calls } = scriptedTransport(jsonResponse(200, { id: 1, title: "n" }), jsonResponse(200, { id: 1, title: "n" }), jsonResponse(401, { success: false, error: "expired" }), jsonResponse(200, { success: true, data: 1 }));
    const client = createHttpClient({ transport, onUnauthorized: async () => "retry" });
    await client.request(create, { title: "n" }, { idempotencyKey: "attempt-1" });
    await client.post("/v1/tickets", { title: "n" }, { idempotencyKey: "attempt-2" });
    await client.post("/v1/tickets", {}, { idempotencyKey: "attempt-3" });
    const sent = calls.map((call) => new Headers(call.init.headers).get("Idempotency-Key"));
    expect(sent).toEqual(["attempt-1", "attempt-2", "attempt-3", "attempt-3"]);
  });

  it("is absent without the option, and wins over a header of the same name", async () => {
    const { client, calls } = setup(jsonResponse(200, { id: 1, title: "n" }), jsonResponse(200, { id: 1, title: "n" }));
    await client.request(create, { title: "n" });
    await client.request(create, { title: "n" }, { headers: { "Idempotency-Key": "old", "X-Other": "kept" }, idempotencyKey: "new" });
    expect(new Headers(calls[0]?.init.headers).has("Idempotency-Key")).toBe(false);
    expect(new Headers(calls[1]?.init.headers).get("Idempotency-Key")).toBe("new");
    expect(new Headers(calls[1]?.init.headers).get("X-Other")).toBe("kept");
  });
});
