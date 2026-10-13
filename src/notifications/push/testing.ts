// A fake browser push for this folder's tests; the declaration build excludes it. It stands in for the Push API, the
// Notification permission and the service worker registration, so no real push service is ever contacted.

export const PUBLIC_KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

export interface FakeSubscription {
  endpoint: string;
  options: { applicationServerKey: ArrayBuffer | null };
  toJSON(): { endpoint: string; keys: { p256dh: string; auth: string } };
  unsubscribe: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
}

export function fakeSubscription(endpoint = "https://push.example.test/send/abc", key: ArrayBuffer | null = null): FakeSubscription {
  return { endpoint, options: { applicationServerKey: key }, toJSON: () => ({ endpoint, keys: { p256dh: "p256dh-key", auth: "auth-secret" } }), unsubscribe: vi.fn(async () => true) };
}

export interface FakePush {
  permission: NotificationPermission;
  /** What the browser's prompt answers. */
  answer: NotificationPermission;
  prompts: number;
  subscription: FakeSubscription | null;
  subscribed: number;
  restore(): void;
}

export interface FakePushOptions {
  permission?: NotificationPermission;
  answer?: NotificationPermission;
  subscription?: FakeSubscription | null;
  /** Default true; false leaves the Push API out, as an old browser or a dev server without a worker. */
  supported?: boolean;
  /** Default false. An iPhone Safari tab (true with `standalone: false`, as installed to the home screen with `standalone: true`). */
  iphone?: boolean;
  standalone?: boolean;
}

/** Installs the fake; call `restore()` from `afterEach`, together with `vi.unstubAllGlobals()` (the globals it stubs). */
export function fakePush(options: FakePushOptions = {}): FakePush {
  const state: FakePush = {
    permission: options.permission ?? "default",
    answer: options.answer ?? "granted",
    prompts: 0,
    subscription: options.subscription ?? null,
    subscribed: 0,
    restore: () => undefined,
  };
  const spies: { mockRestore(): void }[] = [];
  const hadWorker = "serviceWorker" in navigator;
  if (options.supported !== false) {
    vi.stubGlobal("PushManager", class {});
    vi.stubGlobal("Notification", {
      get permission() {
        return state.permission;
      },
      requestPermission: async () => {
        state.prompts++;
        state.permission = state.answer;
        return state.permission;
      },
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: async () => ({}),
        ready: Promise.resolve({
          pushManager: {
            getSubscription: async () => state.subscription,
            subscribe: async () => {
              state.subscribed++;
              return (state.subscription = fakeSubscription("https://push.example.test/send/new"));
            },
          },
        }),
      },
    });
  }
  if (options.iphone) {
    spies.push(vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"));
    const real = window.matchMedia.bind(window);
    vi.stubGlobal("matchMedia", (query: string) => (query.includes("display-mode") ? Object.defineProperty(real(query), "matches", { value: options.standalone === true }) : real(query)));
  }
  state.restore = () => {
    for (const spy of spies) spy.mockRestore();
    if (!hadWorker) Reflect.deleteProperty(navigator, "serviceWorker");
  };
  return state;
}
