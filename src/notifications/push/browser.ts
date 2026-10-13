import type { Subscription } from "../../modules/notification/schemas";

/**
 * What this browser can do with Web Push:
 * - `supported`: the permission can be asked for from a tap;
 * - `ios-browser`: an iPhone or iPad Safari tab, where push exists only in the app added to the home screen;
 * - `unsupported`: no Push API or no service worker (an old browser, a dev server without a worker, an iframe).
 */
export type PushSupport = "supported" | "ios-browser" | "unsupported";

/** The browser's side of push, so the logic around it is testable and the real thing is one small adapter. */
export interface PushBrowser {
  support(): PushSupport;
  /** `unknown` where there is no Notification API. */
  permission(): NotificationPermission | "unknown";
  /** Must be called from a tap. */
  requestPermission(): Promise<NotificationPermission>;
  /** This browser's subscription with the application's service worker; null when there is none (or no worker). */
  subscription(): Promise<PushSubscription | null>;
  /** Subscribes with the server's public key (base64url); null without a worker. */
  subscribe(publicKey: string): Promise<PushSubscription | null>;
}

/** The VAPID public key (base64url) as the Push API wants it. */
export function applicationServerKey(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Whether a subscription was made with this key; a rotated key needs a new subscription. A browser that does not report its key counts as matching. */
export function subscribedWithKey(subscription: PushSubscription, base64url: string): boolean {
  const current = subscription.options?.applicationServerKey;
  if (!current) return true;
  const expected = applicationServerKey(base64url);
  const actual = new Uint8Array(current);
  return actual.length === expected.length && actual.every((byte, i) => byte === expected[i]);
}

/** The body go-core registers a device with; null for a subscription without keys. */
export function toSubscription(subscription: PushSubscription): Subscription | null {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
}

/** Hex SHA-256 of the endpoint: the `endpoint_hash` go-core keeps for a device, which tells "this device" in the list. */
export async function endpointHash(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

interface Environment {
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  hasServiceWorker: boolean;
}

export function detectPushSupport(env: Environment): PushSupport {
  // iPadOS reports itself as a Mac; the touch points give it away.
  const apple = /iPhone|iPad|iPod/.test(env.userAgent) || (/Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1);
  if (apple && !env.standalone) return "ios-browser";
  return env.hasPushManager && env.hasNotification && env.hasServiceWorker ? "supported" : "unsupported";
}

/** The real browser. Reads the globals when asked, never on import. */
export function browserPush(): PushBrowser {
  const registration = async (): Promise<ServiceWorkerRegistration | null> => {
    if (!("serviceWorker" in navigator)) return null;
    // `ready` never settles without a registered worker: look first.
    return (await navigator.serviceWorker.getRegistration()) ? navigator.serviceWorker.ready : null;
  };
  return {
    support: () =>
      detectPushSupport({
        userAgent: navigator.userAgent,
        maxTouchPoints: navigator.maxTouchPoints ?? 0,
        standalone: window.matchMedia?.("(display-mode: standalone)").matches === true || (navigator as Navigator & { standalone?: boolean }).standalone === true,
        hasPushManager: "PushManager" in window,
        hasNotification: "Notification" in window,
        hasServiceWorker: "serviceWorker" in navigator,
      }),
    permission: () => ("Notification" in window ? Notification.permission : "unknown"),
    requestPermission: () => Notification.requestPermission(),
    subscription: async () => (await registration())?.pushManager.getSubscription() ?? null,
    subscribe: async (publicKey) => (await registration())?.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) }) ?? null,
  };
}
