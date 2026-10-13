// The notification settings with web push, on a fake server and a mocked browser push: no real push service is ever contacted.
//
//   npm run dev                       (in playground/, then open /push.html#/profile/notifications)
//   push.html?browser=default         the permission was not asked yet (the default)
//   push.html?browser=on|denied|unsupported|iphone      the other states of "This device"
//   push.html?devices=0               no device yet (the empty state)
//   push.html?section=1               one extra section of the application's own
import { createApplication, defineFeature } from "@wssto2/vue-core/app";
import { identityFeature, identityPlatform } from "@wssto2/vue-core/identity";
import { notificationsFeature } from "@wssto2/vue-core/notifications";
import { createPlatform, parseBootstrap } from "@wssto2/vue-core/platform";
import { backofficeShell } from "@wssto2/vue-core/shell";
import { defineComponent, h } from "vue";
import { createWebHashHistory } from "vue-router";
import "../app.css";
import { shellIcons } from "../app/icons";
import { appIcons } from "../icons";

const query = new URLSearchParams(location.search);
const browser = query.get("browser") ?? "default";

// ── the browser's push, mocked ──────────────────────────────────────────────
const endpoint = "https://push.example.invalid/send/playground";
let permission: NotificationPermission = browser === "denied" ? "denied" : browser === "on" ? "granted" : "default";
let subscription: { endpoint: string; options: { applicationServerKey: null }; toJSON(): object; unsubscribe(): Promise<boolean> } | null = null;
const subscribeNow = () =>
  (subscription = { endpoint, options: { applicationServerKey: null }, toJSON: () => ({ endpoint, keys: { p256dh: "p256dh", auth: "auth" } }), unsubscribe: async () => ((subscription = null), true) });
if (browser === "on") subscribeNow();
if (browser !== "unsupported") {
  Object.defineProperty(window, "PushManager", { configurable: true, value: class {} });
  Object.defineProperty(window, "Notification", { configurable: true, value: { get permission() { return permission; }, requestPermission: async () => (permission = "granted") } });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { getRegistration: async () => ({}), ready: Promise.resolve({ pushManager: { getSubscription: async () => subscription, subscribe: async () => subscribeNow() } }) },
  });
}
else {
  // The real browser has them: take them away, as an old browser or an iframe would not have them.
  Reflect.deleteProperty(window, "PushManager");
  Reflect.deleteProperty(window, "Notification");
  Reflect.deleteProperty(Navigator.prototype, "serviceWorker");
}
if (browser === "iphone") {
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" });
}

// ── the server, faked ───────────────────────────────────────────────────────
const setting = (enabled: boolean, source: string) => ({ enabled, source });
const categories = [
  { category: "tickets.assigned", email: setting(true, "default"), push: setting(true, "default") },
  { category: "tickets.commented", email: setting(false, "person"), push: setting(true, "person") },
  { category: "billing.overdue", email: setting(true, "enforced"), push: setting(true, "enforced") },
];
const hashOfEndpoint = async () => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const device = (id: number, label: string, extra: object = {}) => ({ id, label, platform: "web", endpoint_hash: `hash-${id}`, active: true, created_at: "2026-10-01T09:00:00Z", last_seen_at: "2026-10-12T09:00:00Z", last_success_at: null, ...extra });
let devices = query.get("devices") === "0" ? [] : [...(browser === "on" ? [device(1, "Firefox on Linux", { last_success_at: "2026-10-13T08:00:00Z" })] : []), device(2, "Chrome on Windows", { last_success_at: "2026-10-12T10:15:00Z" }), device(3, "Safari on iPhone", { active: false })];

if (browser === "on") void hashOfEndpoint().then((hash) => (devices = devices.map((d) => (d.id === 1 ? { ...d, endpoint_hash: hash } : d))));

const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { "Content-Type": "application/json" } });
const user = { id: 1, login: "ana", name: "Ana Anić", email: "ana@example.com", locale: "en" };

const platform = createPlatform({
  config: parseBootstrap({ locale: "en", app_name: "Push playground", api_base: "/api" }),
  ...identityPlatform(),
  transport: async (url, init) => {
    const { pathname } = new URL(url, location.href);
    const path = pathname.replace(/^\/api/, "");
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    if (path === "/v1/auth/me") return ok({ user, expires_at: new Date(Date.now() + 3_600_000).toISOString(), access: { subject: { kind: "user", id: 1 }, root: false, permissions: {} }, navigation: [] });
    if (path === "/v1/notifications/stream") return new Response(new ReadableStream(), { headers: { "Content-Type": "text/event-stream" } });
    if (path === "/v1/notifications/unread") return ok({ unread_count: 0 });
    if (path === "/v1/notifications") return ok({ items: [], has_more: false });
    if (path === "/v1/notifications/preferences") return ok({ email_available: true, push_available: true, categories, quiet_hours: { enabled: true, start: 1260, end: 420 }, time_zone: "Europe/Zagreb" });
    const channel = path.match(/^\/v1\/notifications\/preferences\/([^/]+)\/push$/);
    if (channel) {
      const known = categories.find((c) => c.category === channel[1])!;
      known.push = setting(body.push, "person");
      return ok(known);
    }
    if (path === "/v1/notifications/push") return ok({ enabled: true, public_key: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U" });
    if (path === "/v1/notifications/devices" && method === "GET") return ok({ items: devices });
    if (path === "/v1/notifications/devices" && method === "POST") {
      const mine = device(1, "This browser", { endpoint_hash: await hashOfEndpoint(), last_success_at: null });
      devices = [mine, ...devices.filter((d) => d.id !== 1)];
      return ok(mine);
    }
    if (path === "/v1/notifications/devices/unsubscribe") return ok({ items: (devices = devices.filter((d) => d.id !== 1)) });
    const one = path.match(/^\/v1\/notifications\/devices\/(\d+)(\/test)?$/);
    if (one) {
      const id = Number(one[1]);
      if (one[2]) return ok({ items: devices });
      if (method === "PATCH") return ok(((devices = devices.map((d) => (d.id === id ? { ...d, label: body.label } : d))), devices.find((d) => d.id === id)));
      return ok({ items: (devices = devices.filter((d) => d.id !== id)) });
    }
    return new Response(JSON.stringify({ success: false, error: "not found", code: "not_found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  },
});

const dealerPolicies = defineComponent({ setup: () => () => h("section", { class: "rounded-xl bg-surface-raised p-4 text-body" }, "Dealer policies: an application's own panel.") });

void createApplication({
  platform,
  shell: backofficeShell(),
  features: [
    identityFeature(),
    defineFeature({ id: "home", routes: [{ name: "home", path: "/", component: { render: () => null } }] }),
    notificationsFeature({
      categories: { "tickets.assigned": { icon: "user3Line", hue: "blue" } },
      ...(query.get("section") ? { settingsSections: [{ id: "dealer", component: dealerPolicies }] } : {}),
    }),
  ],
  router: { history: createWebHashHistory() },
  icons: [appIcons, shellIcons],
  i18n: { messages: { en: { notifications: { categories: { tickets: { assigned: { label: "Ticket assigned to me", description: "When someone gives you a ticket" }, commented: { label: "New comment on my ticket" } }, billing: { overdue: { label: "Overdue invoices" } } } } } } },
}).mount("#app");
