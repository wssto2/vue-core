import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Transport } from "../client";
import { createTestPlatform, deferred, jsonResponse, routedTransport } from "../testing";
import { createInbox, type Inbox } from "./inbox";
import { parseStreamMessage } from "./stream";
import { connection, count, item, NOW, page, type Connection } from "./testing";

const flush = () => vi.advanceTimersByTimeAsync(0);

interface Setup {
  inbox: Inbox;
  controller: AbortController;
  api: ReturnType<typeof routedTransport>["calls"];
  connections: Connection[];
  streamCalls: string[];
  respond: (routes: Record<string, Parameters<typeof routedTransport>[0][string]>) => void;
}

function setup(routes: Parameters<typeof routedTransport>[0] = {}, options: Partial<Parameters<typeof createInbox>[0]> = {}): Setup {
  let table = { "GET /v1/notifications/unread": count(0), ...routes };
  const api = routedTransport(new Proxy(table, { get: (_t, key: string) => (table as Record<string, unknown>)[key] }) as typeof table);
  const platform = createTestPlatform({ transport: api.transport });
  const connections: Connection[] = [];
  const streamCalls: string[] = [];
  const transport: Transport = async (url) => {
    streamCalls.push(url);
    const next = connection();
    connections.push(next);
    return next.response;
  };
  const controller = new AbortController();
  const inbox = createInbox({ http: platform.http, streamUrl: "/api/v1/notifications/stream", signal: controller.signal, transport, now: () => NOW, ...options });
  return { inbox, controller, api: api.calls, connections, streamCalls, respond: (next) => void (table = { ...table, ...next }) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the first page and paging", () => {
  it("loads newest first, and Load more asks for the page before the oldest shown", async () => {
    const { inbox, api, controller } = setup({
      "GET /v1/notifications": (call) => (call.url.includes("before_id") ? page([item(2), item(1)]) : page([item(4), item(3)], true)),
    });
    await inbox.load();
    expect(inbox.list.value.status).toBe("loaded");
    expect(inbox.items.value.map((n) => n.id)).toEqual([4, 3]);
    expect(inbox.hasMore.value).toBe(true);

    await inbox.loadMore();
    expect(api.at(-1)?.url).toContain("before_id=3");
    expect(inbox.items.value.map((n) => n.id)).toEqual([4, 3, 2, 1]);
    expect(inbox.hasMore.value).toBe(false);
    controller.abort();
  });

  it("shows a failed first page as a failure and loads again on request", async () => {
    const { inbox, respond, controller } = setup({ "GET /v1/notifications": jsonResponse(500, { success: false, message: "x" }) });
    await inbox.load();
    expect(inbox.list.value.status).toBe("failed");
    respond({ "GET /v1/notifications": page([item(1)]) });
    await inbox.load();
    expect(inbox.list.value.status).toBe("loaded");
    controller.abort();
  });

  it("keeps what the stream brought while the first page was on its way", async () => {
    const slow = deferred<Response>();
    const { inbox, connections, controller } = setup({ "GET /v1/notifications": () => slow.promise });
    await flush();
    const loading = inbox.load();
    connections[0]?.send({ type: "created", notification: item(9), unread_count: 1 });
    await flush();
    slow.resolve(page([item(8), item(7)]));
    await loading;
    expect(inbox.items.value.map((n) => n.id)).toEqual([9, 8, 7]);
    controller.abort();
  });

  it("drops the answer of an earlier load when a later one started", async () => {
    const first = deferred<Response>();
    let calls = 0;
    const { inbox, controller } = setup({ "GET /v1/notifications": () => (++calls === 1 ? first.promise : page([item(2)])) });
    const earlier = inbox.load();
    await inbox.load();
    first.resolve(page([item(1)]));
    await earlier;
    expect(inbox.items.value.map((n) => n.id)).toEqual([2]);
    controller.abort();
  });

  it("drops a late answer after the session ended", async () => {
    const slow = deferred<Response>();
    const { inbox, controller } = setup({ "GET /v1/notifications": () => slow.promise });
    const loading = inbox.load();
    controller.abort();
    slow.resolve(page([item(1)]));
    await loading;
    expect(inbox.items.value).toEqual([]);
    expect(inbox.list.value.status).toBe("loading");
  });
});

describe("marking read", () => {
  it("marks one read at once and takes the count from the server's answer", async () => {
    const { inbox, api, connections, controller } = setup({
      "GET /v1/notifications": page([item(2), item(1)]),
      "POST /v1/notifications/2/read": count(1),
    });
    await inbox.load();
    await flush();
    connections[0]?.send({ type: "unread", unread_count: 2 });
    await flush();

    const marking = inbox.markRead({ id: 2, read_at: null });
    expect(inbox.items.value.find((n) => n.id === 2)?.read_at).toBe(NOW.toISOString());
    expect(inbox.unreadCount.value).toBe(1);
    await marking;
    expect(api.some((call) => call.method === "POST" && call.url.endsWith("/v1/notifications/2/read"))).toBe(true);
    controller.abort();
  });

  it("takes a failed reading back and asks the server for the count", async () => {
    const { inbox, controller } = setup({
      "GET /v1/notifications": page([item(2)]),
      "GET /v1/notifications/unread": count(1),
      "POST /v1/notifications/2/read": jsonResponse(404, { success: false, message: "gone" }),
    });
    await inbox.load();
    await inbox.markRead({ id: 2, read_at: null });
    expect(inbox.items.value[0]?.read_at).toBeNull();
    expect(inbox.unreadCount.value).toBe(1);
    controller.abort();
  });

  it("does not ask again for one that is read", async () => {
    const { inbox, api, controller } = setup({ "GET /v1/notifications": page([item(2, true)]) });
    await inbox.load();
    await inbox.markRead({ id: 2, read_at: "2026-10-03T10:00:00Z" });
    expect(api.filter((call) => call.method === "POST")).toHaveLength(0);
    controller.abort();
  });

  it("marks all up to the newest id seen, so one that arrives afterwards stays unread", async () => {
    let body: unknown;
    const { inbox, connections, controller } = setup({
      "GET /v1/notifications": page([item(5), item(4)]),
      "POST /v1/notifications/read": (call) => {
        body = JSON.parse(String(call.init.body));
        return count(1); // the one that arrived while the click was on its way
      },
    });
    await inbox.load();
    await flush();
    const marking = inbox.markAllRead();
    connections[0]?.send({ type: "created", notification: item(6), unread_count: 3 });
    await marking;

    expect(body).toEqual({ up_to_id: 5 });
    expect(inbox.items.value.map((n) => [n.id, n.read_at !== null])).toEqual([[6, false], [5, true], [4, true]]);
    expect(inbox.unreadCount.value).toBe(1);
    controller.abort();
  });

  it("marks nothing while nothing has been seen", async () => {
    const { inbox, api, controller } = setup();
    await inbox.markAllRead();
    expect(api.filter((call) => call.method === "POST")).toHaveLength(0);
    controller.abort();
  });
});

describe("the stream", () => {
  it("opens with the count, adds new notifications and follows a reading on another device", async () => {
    const { inbox, connections, streamCalls, controller } = setup({ "GET /v1/notifications": page([item(3), item(2), item(1)]) });
    await inbox.load();
    await flush();
    expect(streamCalls).toEqual(["/api/v1/notifications/stream"]);

    connections[0]?.send({ type: "unread", unread_count: 3 });
    await flush();
    expect(inbox.unreadCount.value).toBe(3);

    connections[0]?.send({ type: "created", notification: item(4), unread_count: 4 });
    await flush();
    expect(inbox.items.value.map((n) => n.id)).toEqual([4, 3, 2, 1]);
    expect(inbox.unreadCount.value).toBe(4);

    connections[0]?.send({ type: "read", read_ids: [4], unread_count: 3 });
    await flush();
    expect(inbox.items.value[0]?.read_at).not.toBeNull();

    connections[0]?.send({ type: "read", all_read: true, read_up_to_id: 2, unread_count: 1 });
    await flush();
    expect(inbox.items.value.map((n) => n.read_at !== null)).toEqual([true, false, true, true]);
    expect(inbox.unreadCount.value).toBe(1);
    controller.abort();
  });

  it("sends the session cookie and asks for an event stream", async () => {
    const seen: RequestInit[] = [];
    const transport: Transport = async (_url, init) => {
      seen.push(init);
      return connection().response;
    };
    const platform = createTestPlatform({ transport: routedTransport({}).transport });
    const controller = new AbortController();
    createInbox({ http: platform.http, streamUrl: "/s", signal: controller.signal, transport });
    await flush();
    expect(seen[0]?.credentials).toBe("include");
    expect(new Headers(seen[0]?.headers).get("Accept")).toBe("text/event-stream");
    controller.abort();
  });

  it("reconnects with a growing wait, refetching the count before each reconnect", async () => {
    const { connections, api, controller } = setup({ "GET /v1/notifications/unread": count(5) });
    await flush();
    connections[0]?.end();
    await flush();
    expect(connections).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(connections).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(connections).toHaveLength(2);
    expect(api.filter((call) => call.url.endsWith("/unread"))).toHaveLength(1);

    connections[1]?.end(); // nothing was heard: the wait doubles
    await flush();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(connections).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(connections).toHaveLength(3);
    controller.abort();
  });

  it("starts the wait over once a connection has been heard", async () => {
    const { connections, controller } = setup({}, { backoff: { min: 1_000, max: 30_000 } });
    await flush();
    connections[0]?.end();
    await vi.advanceTimersByTimeAsync(1_000);
    connections[1]?.send({ type: "unread", unread_count: 0 });
    await flush();
    connections[1]?.end();
    await flush();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(connections).toHaveLength(3);
    controller.abort();
  });

  it("drops a connection that is silent for longer than the heartbeat allows", async () => {
    const { connections, controller } = setup({}, { idleTimeout: 50_000, backoff: { min: 1_000, max: 30_000 } });
    await flush();
    await vi.advanceTimersByTimeAsync(40_000);
    connections[0]?.ping(); // a heartbeat keeps it
    await vi.advanceTimersByTimeAsync(40_000);
    expect(connections[0]?.state.cancelled).toBe(false);
    await vi.advanceTimersByTimeAsync(10_001);
    expect(connections[0]?.state.cancelled).toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(connections).toHaveLength(2);
    controller.abort();
  });

  it("refetches the count and reconnects at once when the page comes back to the foreground", async () => {
    const { inbox, connections, respond, controller } = setup();
    await flush();
    connections[0]?.end();
    await flush(); // waiting out the backoff
    respond({ "GET /v1/notifications/unread": count(7) });
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();
    expect(inbox.unreadCount.value).toBe(7);
    expect(connections).toHaveLength(2);
    controller.abort();
  });

  it("stops everything when the session ends: the connection, the timers and the listeners", async () => {
    const { connections, api, controller } = setup();
    await flush();
    controller.abort();
    await flush();
    expect(connections[0]?.state.cancelled).toBe(true);

    const requests = api.length;
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(api).toHaveLength(requests);
    expect(connections).toHaveLength(1);
  });
});

describe("parseStreamMessage", () => {
  it("reads a data block and ignores heartbeats and unreadable blocks", () => {
    expect(parseStreamMessage(': ping')).toBeNull();
    expect(parseStreamMessage('data: {"type":"unread","unread_count":2}')).toEqual({ type: "unread", unread_count: 2 });
    expect(parseStreamMessage("data: {oops")).toBeNull();
    expect(parseStreamMessage('data: {"type":"other","unread_count":2}')).toBeNull();
  });
});
