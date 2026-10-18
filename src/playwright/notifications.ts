import type { Page, Route } from "@playwright/test";
import type { CategorySettings, Device, DeviceList, Item, Page as InboxPage, Preferences, PushConfig, QuietHours, Setting, Source, StreamEvent, UnreadCount } from "../modules/notification/entities";
import { json, ok, sse } from "./envelope";
import { readRequest, type Call } from "./request";

/**
 * go-core's notification wire as it serves it under `/api/v1/notifications`, for the specs that open the bell, the settings or the
 * failed-events page: the inbox, the live stream, the preferences, push and the devices. A fake with a little state (items, unread
 * count, preferences, devices), so a spec reads what it did through `calls`. The page needs `mockAuth` too.
 */

export type { CategorySettings, Device, Item, QuietHours, Setting };
export type { Call } from "./request";

export const notification = (id: number, title: string, options: { read?: boolean; category?: string; link?: string; body?: string } = {}): Item => ({
  id,
  category: options.category ?? "general",
  title,
  body: options.body ?? "",
  link: options.link ?? "",
  data: {},
  read_at: options.read ? "2026-09-14T11:00:00Z" : null,
  created_at: "2026-09-14T12:00:00Z",
});

export const setting = (enabled: boolean, source: Source = "default"): Setting => ({ enabled, source });

export const device = (id: number, label: string, options: Partial<Device> = {}): Device => ({
  id,
  label,
  platform: "windows",
  endpoint_hash: `hash-${id}`,
  active: true,
  created_at: "2026-09-10T09:00:00Z",
  last_seen_at: "2026-09-13T18:00:00Z",
  last_success_at: null,
  ...options,
});

export type WireOptions = {
  items?: Item[];
  /** The unread count the server says; default the number of unread items. */
  unread?: number;
  categories?: CategorySettings[];
  /** Minutes after midnight: 1260 is 21:00. */
  quiet?: QuietHours;
  timeZone?: string;
  emailAvailable?: boolean;
  pushAvailable?: boolean;
  push?: PushConfig;
  devices?: Device[];
  /** The device a registration creates (the browser's own). */
  registers?: Device;
  /** What each connection of the live stream sends, by its number from 1; default one `unread` snapshot. */
  stream?: (connection: number, state: Wire) => StreamEvent[];
  /** Fails the inbox list while true. */
  failList?: () => boolean;
};

export type Wire = {
  calls: Call[];
  items: Item[];
  unread: number;
  categories: CategorySettings[];
  quiet: QuietHours;
  devices: Device[];
  streams: number;
};

/** Answers every `/api/v1/notifications/**` route like go-core. */
export async function serveNotifications(page: Page, options: WireOptions = {}): Promise<Wire> {
  const wire: Wire = {
    calls: [],
    items: options.items ?? [],
    unread: 0,
    categories: options.categories ?? [],
    quiet: options.quiet ?? { enabled: true, start: 1260, end: 420 },
    devices: options.devices ?? [],
    streams: 0,
  };
  const recount = () => (wire.unread = options.unread ?? wire.items.filter((item) => item.read_at === null).length);
  recount();

  await page.route(/\/api\/v1\/notifications(\/|\?|$)/, (route: Route) => handle(route));

  async function handle(route: Route) {
    const { method, url, body } = readRequest(route);
    const path = url.pathname.replace("/api/v1/notifications", "") || "/";
    if (method !== "GET") wire.calls.push({ method, path, body });
    const count = () => json(ok({ unread_count: wire.unread } satisfies UnreadCount));
    const devices = () => ok({ items: wire.devices } satisfies DeviceList);

    if (path === "/stream") {
      wire.streams++;
      return route.fulfill(sse(options.stream?.(wire.streams, wire) ?? [{ type: "unread", unread_count: wire.unread }]));
    }
    if (path === "/" && method === "GET") {
      if (options.failList?.()) return route.fulfill(json({ success: false, message: "Server error" }, 500));
      const before = Number(url.searchParams.get("before_id") ?? 0);
      return route.fulfill(json(ok({ items: wire.items.filter((item) => !before || item.id < before), has_more: false } satisfies InboxPage)));
    }
    if (path === "/unread") return route.fulfill(count());
    if (path === "/read") {
      const upTo = (body as { up_to_id: number }).up_to_id;
      wire.items.forEach((item) => { if (item.id <= upTo && item.read_at === null) item.read_at = "2026-09-14T12:30:00Z"; });
      recount();
      return route.fulfill(count());
    }
    const read = path.match(/^\/(\d+)\/read$/);
    if (read) {
      const item = wire.items.find((candidate) => candidate.id === Number(read[1]));
      if (item) item.read_at = "2026-09-14T12:30:00Z";
      recount();
      return route.fulfill(count());
    }

    if (path === "/preferences") {
      return route.fulfill(json(ok({
        email_available: options.emailAvailable ?? true,
        push_available: options.pushAvailable ?? (options.push?.enabled ?? false),
        categories: wire.categories,
        quiet_hours: wire.quiet,
        time_zone: options.timeZone ?? "UTC",
      } satisfies Preferences)));
    }
    const channel = path.match(/^\/preferences\/([^/]+?)(\/push)?$/);
    if (channel && method === "PUT") {
      const category = wire.categories.find((candidate) => candidate.category === decodeURIComponent(channel[1]!))!;
      if (channel[2]) category.push = setting((body as { push: boolean }).push, "person");
      else category.email = setting((body as { email: boolean }).email, "person");
      return route.fulfill(json(ok(category)));
    }
    if (path === "/quiet-hours") {
      wire.quiet = body as QuietHours;
      return route.fulfill(json(ok(wire.quiet)));
    }

    if (path === "/push") return route.fulfill(json(ok(options.push ?? { enabled: false, public_key: "" })));
    if (path === "/devices" && method === "GET") return route.fulfill(json(devices()));
    if (path === "/devices" && method === "POST") {
      const mine = options.registers ?? device(1, "Mac · Chrome", { platform: "macos" });
      wire.devices = [mine, ...wire.devices.filter((candidate) => candidate.id !== mine.id)];
      return route.fulfill(json(ok(mine)));
    }
    if (path === "/devices/unsubscribe") {
      const mine = options.registers;
      wire.devices = wire.devices.filter((candidate) => candidate.endpoint_hash !== mine?.endpoint_hash);
      return route.fulfill(json(devices()));
    }
    const one = path.match(/^\/devices\/(\d+)(\/test)?$/);
    if (one) {
      const id = Number(one[1]);
      if (method === "PATCH") wire.devices = wire.devices.map((candidate) => (candidate.id === id ? { ...candidate, label: (body as { label: string }).label } : candidate));
      if (method === "DELETE") wire.devices = wire.devices.filter((candidate) => candidate.id !== id);
      return route.fulfill(json(method === "PATCH" ? ok(wire.devices.find((candidate) => candidate.id === id)) : devices()));
    }
    return route.fulfill(json(ok({})));
  }

  return wire;
}
