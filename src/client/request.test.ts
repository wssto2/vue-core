import { describe, expect, it } from "vitest";
import { createHttpClient } from "./client";
import { isAborted, isApiError } from "./error";
import { route } from "./route";
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
