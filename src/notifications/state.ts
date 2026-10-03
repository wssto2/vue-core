import type { Item, StreamEvent } from "../modules/notification/entities";

/** What the inbox keeps: the notifications this app has loaded or been sent, newest first, and the server's unread count. */
export interface InboxContents {
  readonly items: readonly Item[];
  readonly unreadCount: number;
}

/** The newest id of a list: "Mark all as read" stops there, so a notification nobody has seen stays unread. 0 for none. */
export function newestId(items: readonly Item[]): number {
  return items.reduce((newest, item) => Math.max(newest, item.id), 0);
}

/** One notification marked read here (before the server answers). */
export function markedRead(items: readonly Item[], id: number, readAt: string): readonly Item[] {
  return items.map((item) => (item.id === id && item.read_at === null ? { ...item, read_at: readAt } : item));
}

/** Everything up to `upToId` marked read here. */
export function markedReadUpTo(items: readonly Item[], upToId: number, readAt: string): readonly Item[] {
  return items.map((item) => (item.read_at === null && item.id <= upToId ? { ...item, read_at: readAt } : item));
}

/**
 * The first page of a (re)load, with anything newer the stream brought while the request was on its way: the page was
 * read before it, so it would otherwise vanish until the next load. Newest first, each id once.
 */
export function withNewer(page: readonly Item[], current: readonly Item[]): readonly Item[] {
  const newest = newestId(page);
  return [...current.filter((item) => item.id > newest), ...page];
}

/** A further (older) page appended, ids already shown left out. */
export function withOlder(current: readonly Item[], page: readonly Item[]): readonly Item[] {
  const known = new Set(current.map((item) => item.id));
  return [...current, ...page.filter((item) => !known.has(item.id))];
}

/**
 * One stream event applied. Every event carries the server's unread count and it always wins over counting here
 * (NOTIF-READ-001); a reading on another device marks the same notifications read here. A "read all" names the newest
 * id that device had seen, and only notifications up to it are read.
 */
export function applyStreamEvent(state: InboxContents, event: StreamEvent, readAt: string): InboxContents {
  let items = state.items;

  if (event.type === "created" && event.notification && !items.some((item) => item.id === event.notification?.id)) {
    items = [event.notification, ...items];
  }

  if (event.type === "read") {
    const ids = new Set(event.read_ids ?? []);
    const upTo = event.read_up_to_id ?? 0;
    items = items.map((item) => (item.read_at === null && (event.all_read ? item.id <= upTo : ids.has(item.id)) ? { ...item, read_at: readAt } : item));
  }

  return { items, unreadCount: Math.max(0, event.unread_count) };
}

/** The unread count as a badge shows it: "99+" past 99. */
export function unreadBadge(count: number): string {
  return count > 99 ? "99+" : String(count);
}
