import { readonly, ref, shallowRef, type Ref } from "vue";
import { fetchTransport, type HttpClient, type Transport } from "../client";
import type { Item } from "../modules/notification/entities";
import { notificationRoutes } from "../modules/notification/routes";
import { applyStreamEvent, markedRead, markedReadUpTo, newestId, withNewer, withOlder } from "./state";
import { readStream } from "./stream";

/** The first page of the inbox: not asked yet, on its way, here, or failed (`error` is what the request rejected with). */
export type InboxList =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "loaded" }
  | { readonly status: "failed"; readonly error: unknown };

export interface InboxOptions {
  http: HttpClient;
  /** The stream's whole address (the API base and `/v1/notifications/stream`). */
  streamUrl: string;
  /** Ends everything the inbox does: the stream, its timers and listeners, and the answers still on their way. */
  signal: AbortSignal;
  /** Reads the stream; default `fetch`. */
  transport?: Transport;
  /** Notifications per request, at most 50 (go-core's limit). Default 20. */
  pageSize?: number;
  /** The wait before reconnecting grows from `min` to `max`, in milliseconds. Default 1 s to 30 s. */
  backoff?: { readonly min: number; readonly max: number };
  /** How long a silent connection lives; go-core beats every 25 s, so the default is 50 s. */
  idleTimeout?: number;
  /** The moment to stamp a reading made here with. Default now. */
  now?: () => Date;
}

/**
 * One signed-in person's inbox: what the bell and the list show. It keeps the live stream open for as
 * long as `signal` lives, and nothing of it outlives the session.
 */
export interface Inbox {
  /** Newest first: what was loaded plus what the stream brought. */
  readonly items: Readonly<Ref<readonly Item[]>>;
  /** The server's count, kept current by every answer and every stream event. */
  readonly unreadCount: Readonly<Ref<number>>;
  readonly hasMore: Readonly<Ref<boolean>>;
  readonly list: Readonly<Ref<InboxList>>;
  /** Whether "Load more" is running or failed. */
  readonly more: Readonly<Ref<"idle" | "loading" | "failed">>;
  /** Reads the first page again (opening the inbox). A reload while one is running makes the earlier answer irrelevant. */
  load(): Promise<void>;
  loadMore(): Promise<void>;
  /** Marks one notification read here at once and, through the server, on every device. A reading that fails is taken back. */
  markRead(item: Pick<Item, "id" | "read_at">): Promise<void>;
  /** Marks read what the person has seen: everything up to the newest id this inbox shows. A notification that arrives afterwards stays unread. */
  markAllRead(): Promise<void>;
}

/**
 * Starts the inbox of a session. Staying right when the connection drops: the stream opens with the
 * count; a reconnect waits 1 s, 2 s, … up to 30 s, and refetches the count first (through the platform's
 * client, which also renews an expired session); a connection silent for two heartbeats is dropped and
 * redone; coming back to the foreground or online refetches the count and reconnects at once.
 */
export function createInbox(options: InboxOptions): Inbox {
  const { http, signal, pageSize = 20, backoff = { min: 1_000, max: 30_000 }, idleTimeout = 50_000, transport = fetchTransport, now = () => new Date() } = options;

  const items = shallowRef<readonly Item[]>([]);
  const unreadCount = ref(0);
  const hasMore = ref(false);
  const list = shallowRef<InboxList>({ status: "idle" });
  const more = ref<"idle" | "loading" | "failed">("idle");
  let generation = 0; // a first-page load makes the answers of earlier ones, and of "Load more", irrelevant

  const stamp = () => now().toISOString();

  async function refreshUnread(): Promise<void> {
    try {
      const { data } = await http.request(notificationRoutes.unread, undefined, { signal });
      if (!signal.aborted) unreadCount.value = data.unread_count;
    } catch {
      // the stream's opening count corrects it when the connection is back
    }
  }

  async function load(): Promise<void> {
    const mine = ++generation;
    more.value = "idle";
    list.value = { status: "loading" };
    try {
      const { data } = await http.request(notificationRoutes.list, { limit: pageSize }, { signal });
      if (signal.aborted || mine !== generation) return;
      items.value = withNewer(data.items, items.value);
      hasMore.value = data.has_more;
      list.value = { status: "loaded" };
    } catch (error) {
      if (signal.aborted || mine !== generation) return;
      list.value = { status: "failed", error };
    }
  }

  async function loadMore(): Promise<void> {
    const oldest = items.value[items.value.length - 1]?.id;
    if (!hasMore.value || more.value === "loading" || oldest === undefined) return;
    const mine = generation;
    more.value = "loading";
    try {
      const { data } = await http.request(notificationRoutes.list, { before_id: oldest, limit: pageSize }, { signal });
      if (signal.aborted || mine !== generation) return;
      items.value = withOlder(items.value, data.items);
      hasMore.value = data.has_more;
      more.value = "idle";
    } catch {
      if (!signal.aborted && mine === generation) more.value = "failed";
    }
  }

  async function markRead(item: Pick<Item, "id" | "read_at">): Promise<void> {
    if (item.read_at !== null || items.value.find((known) => known.id === item.id)?.read_at) return;
    items.value = markedRead(items.value, item.id, stamp());
    unreadCount.value = Math.max(0, unreadCount.value - 1);
    try {
      const { data } = await http.request(notificationRoutes.read, { id: item.id }, { signal });
      if (!signal.aborted) unreadCount.value = data.unread_count;
    } catch {
      if (signal.aborted) return;
      items.value = items.value.map((known) => (known.id === item.id ? { ...known, read_at: null } : known));
      await refreshUnread();
    }
  }

  async function markAllRead(): Promise<void> {
    const upTo = newestId(items.value);
    if (upTo === 0) return; // nothing seen: the server would have nothing to stop at
    const changed = new Set(items.value.filter((item) => item.read_at === null && item.id <= upTo).map((item) => item.id));
    items.value = markedReadUpTo(items.value, upTo, stamp());
    unreadCount.value = Math.max(0, unreadCount.value - changed.size);
    try {
      const { data } = await http.request(notificationRoutes.readAll, { up_to_id: upTo }, { signal });
      if (!signal.aborted) unreadCount.value = data.unread_count;
    } catch {
      if (signal.aborted) return;
      items.value = items.value.map((item) => (changed.has(item.id) ? { ...item, read_at: null } : item));
      await refreshUnread();
    }
  }

  // The stream: one connection at a time, reconnected with a growing wait until the signal ends.
  let delay = backoff.min;
  let wake: (() => void) | null = null;

  const pause = (milliseconds: number) =>
    new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", done);
        wake = null;
        resolve();
      };
      const timer = setTimeout(done, milliseconds);
      signal.addEventListener("abort", done, { once: true });
      wake = done;
    });

  async function keepConnected(): Promise<void> {
    for (let reconnect = false; !signal.aborted; reconnect = true) {
      if (reconnect) await refreshUnread();
      if (signal.aborted) return;
      let heard = false;
      await readStream({
        url: options.streamUrl,
        transport,
        signal,
        idleTimeout,
        onEvent(event) {
          heard = true;
          const next = applyStreamEvent({ items: items.value, unreadCount: unreadCount.value }, event, stamp());
          items.value = next.items;
          unreadCount.value = next.unreadCount;
        },
      });
      if (signal.aborted) return;
      if (heard) delay = backoff.min;
      await pause(delay);
      delay = Math.min(delay * 2, backoff.max);
    }
  }

  // A phone suspended in the background loses its stream and its timers: catch up when it is back.
  const onForeground = () => {
    if (document.visibilityState !== "visible") return;
    void refreshUnread();
    delay = backoff.min;
    wake?.();
  };
  const onOnline = () => {
    void refreshUnread();
    delay = backoff.min;
    wake?.();
  };
  document.addEventListener("visibilitychange", onForeground);
  window.addEventListener("online", onOnline);
  signal.addEventListener(
    "abort",
    () => {
      document.removeEventListener("visibilitychange", onForeground);
      window.removeEventListener("online", onOnline);
    },
    { once: true },
  );
  if (!signal.aborted) void keepConnected();

  return { items: readonly(items), unreadCount: readonly(unreadCount), hasMore: readonly(hasMore), list: readonly(list), more: readonly(more), load, loadMore, markRead, markAllRead };
}
