import { readonly, ref, type Ref } from "vue";
import type { HttpClient } from "../../client";
import { notificationRoutes } from "../../modules/notification/routes";
import { usePlatform } from "../../platform";
import { browserPush, endpointHash, subscribedWithKey, toSubscription, type PushBrowser } from "./browser";

/** What the "this device" panel shows: one state at a time. */
export type ThisDeviceState = "loading" | "unsupported" | "ios-browser" | "denied" | "off" | "on";

export interface ThisDevice {
  readonly state: Readonly<Ref<ThisDeviceState>>;
  /** `endpoint_hash` of this browser's subscription, to mark its row in the device list; null without one. */
  readonly hash: Readonly<Ref<string | null>>;
  readonly busy: Readonly<Ref<boolean>>;
  /** Reads this browser's state; registers nothing. */
  inspect(): Promise<void>;
  /** Asks for the permission and registers this browser. Call it from a tap. Resolves to the state it ended in. */
  enable(): Promise<ThisDeviceState>;
  /** Stops push on this browser only: the device is removed from the account and the subscription cancelled. */
  disable(): Promise<void>;
}

async function register(http: HttpClient, subscription: PushSubscription, signal?: AbortSignal): Promise<string | null> {
  const body = toSubscription(subscription);
  if (!body) return null;
  await http.request(notificationRoutes.deviceSubscribe, body, signal ? { signal } : undefined);
  return endpointHash(body.endpoint);
}

/** Cancels this browser's subscription at the account and in the browser; a failing server call never keeps the browser subscribed. */
export async function unsubscribeThisBrowser(http: HttpClient, browser: PushBrowser = browserPush(), signal?: AbortSignal): Promise<void> {
  const subscription = await browser.subscription();
  if (!subscription) return;
  await http.request(notificationRoutes.deviceUnsubscribe, { endpoint: subscription.endpoint }, signal ? { signal } : undefined).catch(() => undefined);
  await subscription.unsubscribe().catch(() => false);
}

/**
 * Re-registers a subscription this browser already holds, for the person who just signed in: go-core makes registering
 * again idempotent, and it is what refreshes the device's last use, re-enables a disabled one and moves a shared computer's
 * endpoint to the person signed in now. Once per session, never prompts; a subscription made with a rotated key is replaced,
 * one the browser's permission no longer backs is dropped.
 */
export async function syncThisBrowser(http: HttpClient, browser: PushBrowser, signal?: AbortSignal): Promise<void> {
  if (browser.support() !== "supported") return;
  let subscription = await browser.subscription();
  if (!subscription) return;
  if (browser.permission() !== "granted") {
    await subscription.unsubscribe().catch(() => false);
    return;
  }
  const { data: config } = await http.request(notificationRoutes.push, undefined, signal ? { signal } : undefined);
  if (!config.enabled) return;
  if (!subscribedWithKey(subscription, config.public_key)) {
    await subscription.unsubscribe();
    subscription = await browser.subscribe(config.public_key);
  }
  if (subscription) await register(http, subscription, signal);
}

/** This browser's push subscription, for the settings panel. */
export function useThisDevice(http: HttpClient = usePlatform().http, browser: PushBrowser = browserPush()): ThisDevice {
  const state = ref<ThisDeviceState>("loading");
  const hash = ref<string | null>(null);
  const busy = ref(false);

  async function inspect(): Promise<void> {
    const support = browser.support();
    if (support !== "supported") {
      state.value = support;
      return;
    }
    const subscription = await browser.subscription().catch(() => null);
    hash.value = subscription ? await endpointHash(subscription.endpoint) : null;
    state.value = browser.permission() === "denied" ? "denied" : subscription && browser.permission() === "granted" ? "on" : "off";
  }

  async function enable(): Promise<ThisDeviceState> {
    if (browser.support() !== "supported") return state.value;
    busy.value = true;
    try {
      const { data: config } = await http.request(notificationRoutes.push, undefined);
      if (!config.enabled) return state.value;
      if ((await browser.requestPermission()) !== "granted") {
        state.value = browser.permission() === "denied" ? "denied" : "off";
        return state.value;
      }
      let subscription = await browser.subscription();
      if (subscription && !subscribedWithKey(subscription, config.public_key)) {
        await subscription.unsubscribe();
        subscription = null;
      }
      subscription ??= await browser.subscribe(config.public_key);
      if (subscription) {
        hash.value = await register(http, subscription);
        state.value = "on";
      }
      return state.value;
    } finally {
      busy.value = false;
    }
  }

  async function disable(): Promise<void> {
    busy.value = true;
    try {
      await unsubscribeThisBrowser(http, browser);
      hash.value = null;
      state.value = "off";
    } finally {
      busy.value = false;
    }
  }

  return { state: readonly(state), hash: readonly(hash), busy: readonly(busy), inspect, enable, disable };
}
