// The push half of an application's service worker, for go-core's web push. It imports nothing from the library's UI and
// touches no global on import: the application's own worker file calls `installPushHandlers()`.
//
//   // sw.ts (the application's service worker, which keeps its own caching), after importing installPushHandlers
//   // from the package's "push-worker" subpath:
//   installPushHandlers({ icon: "/icons/192.png" });

/** The JSON go-core's push worker sends (NOTIF-DEVICE-001): no secrets and no customer contact data. */
export interface PushPayload {
  /** 0 for a bundle of several notifications. */
  notification_id: number;
  category: string;
  title: string;
  body: string;
  /** An in-app path. */
  link: string;
  /** Notifications with the same tag replace each other. */
  tag: string;
  /** For the app icon badge; absent when the server did not say. */
  unread_count?: number;
}

export interface PushHandlersOptions {
  /** The notification's icon (a URL on the application's origin). */
  icon?: string;
  /** The small monochrome badge some platforms draw; default the icon. */
  badge?: string;
  /** Shown when a push carries no title. Default "". */
  fallbackTitle?: string;
}

/** A push payload read defensively: a missing or malformed field becomes its empty value, so a notification is always shown. */
export function readPayload(raw: unknown): PushPayload {
  const data = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const text = (key: string) => (typeof data[key] === "string" ? (data[key] as string) : "");
  return {
    notification_id: typeof data.notification_id === "number" ? data.notification_id : 0,
    category: text("category"),
    title: text("title"),
    body: text("body"),
    link: text("link"),
    tag: text("tag"),
    ...(typeof data.unread_count === "number" ? { unread_count: data.unread_count } : {}),
  };
}

/**
 * The path, query and hash of a link when it stays on `origin`, "/" otherwise: a payload can name another site or a
 * `javascript:` URL, and only the application's own pages are ever opened.
 */
export function sameOriginLink(link: unknown, origin: string): string {
  if (typeof link !== "string" || link === "") return "/";
  try {
    const url = new URL(link, origin);
    return url.origin === origin ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}

interface WaitableEvent {
  waitUntil(work: Promise<unknown>): void;
}
interface PushEventLike extends WaitableEvent {
  data: { json(): unknown } | null;
}
interface NotificationClickEventLike extends WaitableEvent {
  notification: { close(): void; data?: unknown };
}
interface WindowClientLike {
  url: string;
  focus(): Promise<unknown>;
  navigate?(url: string): Promise<unknown>;
}

/** The part of the service worker's global scope the handlers use; `self` is one. */
export interface PushWorkerScope {
  addEventListener(type: "push", listener: (event: PushEventLike) => void): void;
  addEventListener(type: "notificationclick", listener: (event: NotificationClickEventLike) => void): void;
  location: { origin: string };
  registration: { showNotification(title: string, options: { body: string; icon?: string; badge?: string; tag?: string; data: { notification_id: number; link: string } }): Promise<void> };
  clients: { matchAll(options: { type: "window"; includeUncontrolled: true }): Promise<readonly WindowClientLike[]>; openWindow(url: string): Promise<unknown> };
  navigator: { setAppBadge?(count: number): Promise<void>; clearAppBadge?(): Promise<void> };
}

/**
 * Adds the two handlers go-core's web push needs to the service worker:
 *
 * - `push` shows every push as a notification (browsers, Apple's above all, drop a subscription that pushes silently), titled and
 *   tagged as the payload says, and sets the app icon badge to its `unread_count` (clearing it at 0);
 * - `notificationclick` closes the notification and brings the application's window to the front on the notification's link: an
 *   open window of this origin is focused and navigated, otherwise a new one is opened. A link to another origin opens "/".
 *
 * Call it once, at the top level of the worker's file. `scope` is the worker's global scope (`self`) and is only given in tests.
 */
export function installPushHandlers(options: PushHandlersOptions = {}, scope: PushWorkerScope = self as unknown as PushWorkerScope): void {
  scope.addEventListener("push", (event) => {
    let raw: unknown;
    try {
      raw = event.data?.json();
    } catch {
      raw = undefined;
    }
    const payload = readPayload(raw);
    const shown = scope.registration.showNotification(payload.title || options.fallbackTitle || "", {
      body: payload.body,
      ...(options.icon ? { icon: options.icon } : {}),
      ...((options.badge ?? options.icon) ? { badge: options.badge ?? options.icon } : {}),
      ...(payload.tag ? { tag: payload.tag } : {}),
      data: { notification_id: payload.notification_id, link: sameOriginLink(payload.link, scope.location.origin) },
    });
    const { unread_count: unread } = payload;
    const badge =
      unread !== undefined && scope.navigator.setAppBadge && scope.navigator.clearAppBadge
        ? (unread > 0 ? scope.navigator.setAppBadge(unread) : scope.navigator.clearAppBadge()).catch(() => undefined)
        : Promise.resolve();
    event.waitUntil(Promise.all([shown, badge]));
  });

  scope.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const data = (event.notification.data ?? {}) as { link?: unknown };
    const link = sameOriginLink(data.link, scope.location.origin); // checked again: the data came from the page's own notification, but costs nothing
    event.waitUntil(
      scope.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
        const open = windows.find((client) => new URL(client.url).origin === scope.location.origin);
        if (!open) return scope.clients.openWindow(link);
        await open.focus();
        // Only a window the worker controls can be navigated; for another one a fresh window is the way to the link.
        return open.navigate ? open.navigate(link).catch(() => scope.clients.openWindow(link)) : scope.clients.openWindow(link);
      }),
    );
  });
}
