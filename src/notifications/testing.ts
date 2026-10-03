// Fixtures for this folder's tests; the declaration build excludes it.
import type { Item, StreamEvent } from "../modules/notification/entities";
import { jsonResponse } from "../testing";

export const NOW = new Date("2026-10-03T12:00:00Z");

export function item(id: number, read = false, extra: Partial<Item> = {}): Item {
  return { id, category: "tickets.assigned", title: `N${id}`, body: "", link: "/tickets", data: {}, read_at: read ? "2026-10-03T10:00:00Z" : null, created_at: "2026-10-03T09:00:00Z", ...extra };
}
export const page = (items: Item[], hasMore = false) => jsonResponse(200, { success: true, data: { items, has_more: hasMore } });
export const count = (unread: number) => jsonResponse(200, { success: true, data: { unread_count: unread } });

/** One connection of the stream, written to by the test. */
export function connection() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const state = { cancelled: false };
  const body = new ReadableStream<Uint8Array>({
    start: (c) => void (controller = c),
    cancel: () => void (state.cancelled = true),
  });
  const encoder = new TextEncoder();
  return {
    response: new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
    send: (event: StreamEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)),
    ping: () => controller.enqueue(encoder.encode(": ping\n\n")),
    end: () => controller.close(),
    state,
  };
}
export type Connection = ReturnType<typeof connection>;
